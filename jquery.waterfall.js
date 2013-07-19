/*
Simple min-height-masonry layout plugin.
Like masonry column shift, but works.
*/
;(function ($){
	var Waterfall = function (el, opts){
		this.container = $(el);
		this._create(opts)
	}

	Waterfall.defaultClass = "waterfall";

	$.extend(Waterfall.prototype, {
		options: {
			itemSelector: null,
			colMinWidth: 300,
			defaultContainerWidth: $(window).width(),
			colClass: null,
			autoresize: true,
			order: "waterfall", //TODO: columns order, like
			reflowDelay: 100
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts),

			cStyle = getComputedStyle(self.container[0]);

			self.container[0].style.height = cStyle.height; //prevent scrollbar width changing
			if (self.container.css("position") === "static" ) self.container[0].style.position = "relative";


			self.pl = parseInt(cStyle["padding-left"])
			self.pt = parseInt(cStyle["padding-top"])
			self.pr = parseInt(cStyle["padding-right"])
			self.pb = parseInt(cStyle["padding-bottom"])

			//self.items = [];
			self.columns = []; //array of arrays of elements = waterfall model. Spanning elements may present in both ajacent arrays.
			self.prevItems = {}; //map of itemId - [prevel1, prevel2, ..]

			var colClass = o.colClass ? o.colClass : 'wf-column';
			if (self.container.children().hasClass(colClass)) {
				self.items = []
				//Columns init — keep initial order of items
				var cols = $('.' + colClass, self.container),
					children = $('.' + colClass, self.container).children();
				var i = 0, end = children.length * cols.length;
				while (self.items.length < children.length && i < end) {
					var el = cols.eq(i%3).children()[Math.floor(i/3)];
					if (el) self.items.push(el);
					i++;
				}
			} else {
				//Items init
				//self.container.children().each(function(i,e){
				//	self.items.push($(e));
				//});
				self.items = self.container[0].children;
			}

			self.lastItem = self.items[self.items.length-1]
			self.firstItem = self.items[0]
			
			self._removeColumns();
			
			for (var i = self.items.length; i--;){
				//self.items[i].data("id", i);
				self.items[i].style.position = "absolute";
			}

			o.colMinWidth = opts.colMinWidth || o.colMinWidth;

			self._update();

			if (o.autoresize) {
				$(window).resize(self.reflow.bind(self))
			}
		},



		//==========================API
		//getset options
		getOption: function (name) {
			return this.options && this.options[name];
		},
		getOptions: function () {
			return this.options;
		},
		setOption: function (name, value) {
			if (this.options) {this.options[name] = value;}
			this.reflow();
			return this;
		},
		setOptions: function (opts) {
			this.options = $.extend(this.options, opts);
			this.reflow()
			return this;
		},

		//Ensures column number correct, reallocates items
		_reflowInterval: 0,
		reflow: function () {
			var self = this, o = self.options;

			window.clearTimeout(self._reflowInterval);
			self._reflowInterval = window.setTimeout(self._update.bind(self), o.reflowDelay);

			return self;
		},

		//Inserts new item(s)
		add: function (itemSet) {
			var self = this, o = self.options, cols = self.container.children();

			itemSet = $(itemSet);

			itemSet.each(function (i, el) {
				var $el = $(el).data("id", self.items.length).css("position","absolute");
				self.items.push($el);
				self.container.append($el)
			})

			self.lastItem = self.items[self.items.length-1];
			self._redistribute();

			return self;
		},


		//========================= Techs
		_update: function(){
			var self = this, o = self.options,
				e = self.items[0], i = 0, 
				lastItems = [], //last elements by columns
				lastHeights = [0,0,0,0,0,0,0,0,0,0,0,0], //bottoms of last elements
				colPriority = [0,1,2,3,4,5,6,7,8,9,10, 11], //most left = most minimal column. 
				lastMin = 0,
				minCol = 0, minH = Number.MAX_VALUE, maxH = 0, h = 0, c = 0,
				span = 1,
				newH = 0,
				colW = self.container[0].clientWidth - self.pl - self.pr,
				style;

			lastItems.length = ~~(colW / o.colMinWidth) || 1; //needed length
			lastHeights.length = lastItems.length;
			colW /= lastItems.length;
			colPriority.length = lastItems.length;

			for (i = 0; i < self.items.length; i++){
				e = self.items[i];			
				span = e.getAttribute("data-span") || 1;
				span = (span === "all" ? lastItems.length : Math.min( span, lastItems.length));

				minCol = colPriority.shift();
				minH = self._getBottom(lastItems[minCol]);

				style = getComputedStyle(e);

				e.style.width = colW * span - parseInt(style.marginRight) - parseInt(style.marginLeft);
				e.style.top = minH;
				e.style.left = colW * minCol + self.pl;

				lastItems[minCol] = e;
				newH = Number(self._getBottom(e));
				lastHeights[minCol] = newH;

				//Update colPriority
				for (c = colPriority.length; c--;){
					h = Number(lastHeights[colPriority[c]]);
					if (newH >= h){
						colPriority.splice(c+1,0,minCol);
						break;
					}
				}
				if (colPriority.length < lastHeights.length){
					colPriority.push(minCol)
				}
			}

			//Maximize height
			self.container[0].style.height = lastHeights[colPriority[colPriority.length - 1]] + self.pb;
		},

		_getMaxHeight: function(items){
			var self = this, maxH = self.pt, h = 0, maxColNum = 0;
			
			for (var i = items.length; i--;){
				if (!items[i] || !items[i].length) continue;
				h = self._getBottom(items[i]);
				if (h > maxH){
					maxH = h;
					maxColNum = i;
				}
			}
			return maxH;
		},

		//get bottom of element
		_getBottom: function(e) {
			if (!e) return this.pt;
			var s = getComputedStyle(e);
			return parseInt(s.top) + e.clientHeight + parseInt(s.marginTop) + parseInt(s.marginBottom);
		},

		//calc needed number of columns
		_countNeededColumns: function () {
			var self = this, o = self.options;
			return ~~((self.container.width() || o.defaultContainerWidth) / o.colMinWidth) || 1;
		},



		//Ensures that columns has correct classes etc
		_removeColumns: function(){
			var self = this, o = self.options;
			var items = $(self.items);
			items.detach();
			self.container.children().remove();
			self.container.append(items)
			return self;
		},

		_clearClasses: function(){
			var self = this;
			for (var i = 0; i < self.items.length; i++){
				self.items[i].removeClass("wf-column-last wf-column-first wf-column-" + self.items[i].data("colNum"))
			}
		},

		_insertToColumn: function(colNum, $e, span) {
			var self = this, o = self.options;

			span = Math.min(self.columns.length - colNum, span);

			self.prevItems[$e.data("id")] = self._getLastItems(colNum, colNum + span);
			self._setItemPosition(colNum, $e, span);
			
			$e.data("colNum", colNum);
			$e.addClass("wf-column-" + colNum);
			if (colNum == self.columns.length - 1){
				$e.addClass("wf-column-last")
			} else if (colNum == 0){
				$e.addClass("wf-column-first")
			}
			if (span){
				$e.addClass("wf-span-"+span).data("spanNum", span);
			}

			for (var i = 0; i < span; i++){
				self.columns[colNum + i].push($e);
			}
			
		}
		
	})


	$.fn.waterfall = function (arg, arg2) {
		if (typeof arg == "string") {//Call API method
			return $(this).each(function (i, el) {
				$(el).data("waterfall")[arg](arg2);
			})
		} else {
			return $(this).each(function (i, el) {
				var wf = new Waterfall(el, arg);
				if (!$(el).data("waterfall")) $(el).data("waterfall", wf);
			})			
		}
	}


	//Simple options parser. The same as $.fn.data(), or element.dataset but for zepto
	if (!$.parseDataAttributes) {
		$.parseDataAttributes = function(el){
			var data = {};
			if (el.dataset) {
				$.extend(data, el.dataset);
			} else {
				[].forEach.call(el.attributes, function(attr) {
					if (/^data-/.test(attr.name)) {
						var camelCaseName = attr.name.substr(5).replace(/-(.)/g, function ($0, $1) {
						    return $1.toUpperCase();
						});
						data[camelCaseName] = attr.value;
					}
				});
			}
			return data;
		}
	}


	$(function () {
		var defClass = window.waterfall && window.waterfall.defaultClass || Waterfall.defaultClass;

		$("." + defClass).each(function (i, e){
				var $e = $(e),
					opts = $.extend(window.waterfall || {}, $.parseDataAttributes(e));
					if (opts.width && !opts.colMinWidth) {
						opts.colMinWidth = opts.width
					}
				$e.waterfall(opts);
			});
		})

})(window.jQuery || window.Zepto);