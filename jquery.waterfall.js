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
			itemSelector: null, //TODO: ignore out-of-selector items as out-of-order
			colMinWidth: 300,
			defaultContainerWidth: window.clientWidth,
			colClass: null,
			autoresize: true,
			order: "waterfall", //TODO: columns order, like css3 columns
			updateDelay: 50
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts);

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
				self._removeColumns();
			} else {
				//Items init
				//self.container.children().each(function(i,e){
				//	self.items.push($(e));
				//});
				self.items = self.container[0].children;
			}

			self.lastItem = self.items[self.items.length-1]
			self.firstItem = self.items[0]
						
			for (var i = self.items.length; i--;){
				//self.items[i].data("id", i);
				self.items[i].style.position = "absolute";
			}

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
		_updateInterval: 0,
		reflow: function () {
			var self = this, o = self.options;

			window.clearTimeout(self._updateInterval);
			self._updateInterval = window.setTimeout(self._update.bind(self), o.updateDelay);

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
				lastHeights = [self.pt,self.pt,self.pt,self.pt,self.pt,self.pt,self.pt,self.pt,self.pt,self.pt,self.pt,self.pt], //bottoms of last elements
				colPriority = [0,1,2,3,4,5,6,7,8,9,10,11], //most left = most minimal column. 
				lastMin = 0,
				minCol = 0, maxH = 0, 
				maxCol = 0, //Max column above
				minH = 0, h = 0, c = 0, t = 0, end = 0, start = 0,
				span = 1,
				newH = 0,
				spanCols = [],
				spanHeights = [],
				colW = self.container[0].clientWidth - self.pl - self.pr,
				style,
				float, floatCol = 0;

			lastItems.length = ~~(colW / o.colMinWidth) || 1; //needed length
			lastHeights.length = lastItems.length;
			colW /= lastItems.length;
			colPriority.length = lastItems.length;

			for (i = 0; i < self.items.length; i++){
				e = self.items[i];
				span = e.getAttribute("data-span") || 1;
				span = (span === "all" ? lastItems.length : Math.max(0,Math.min( Number(span), lastItems.length)));
				spanCols.length = 0;

				//console.log("------ item"+i+": "+e.innerHTML)
				//console.log(colPriority)
				//console.log("span:"+span)
				//console.log(spanCols)

				float = e.getAttribute("data-float") || e.getAttribute("data-column");
				switch (float){
					case null: //no float
						floatCol = null;
						break;
					case "right":
					case "last":
						floatCol = lastHeights.length - span;
						break;
					case "left":
					case "first":
						floatCol = 0;
						break;
					default: //int column
						floatCol = Math.max(Math.min(lastHeights.length - span, parseInt(float)), 0);
						break;
				}

				//Find proper column to place item
				//console.log(colPriority)
				if (span === 1){//Simple element
					if (float){
						minCol = floatCol;
						for (c = 0; c < colPriority.length; c++){
							if (colPriority[c] == minCol){
								colPriority.splice(c, 1);
								break;
							}
						}
					} else {
						minCol = colPriority.shift();
					}
					spanCols.push(minCol);
					minH = lastHeights[minCol];
				} else if (span === lastItems.length){//Full-span element
					minCol = 0;
					minH = lastHeights[colPriority[colPriority.length - 1]];
					spanCols = colPriority.slice();
					colPriority.length = 0;
				} else {//Some-span element
					if (float){
						minCol = floatCol;
						minH = Math.max.apply(Math, lastHeights.slice(minCol, minCol + span));
						//console.log(lastHeights.slice(minCol, span))
						//console.log("fCol:" + floatCol + " minH: " + minH)
					} else {
						//Make span heights alternatives
						spanHeights.length = 0;
						minH = Infinity; minCol = 0;
						for (c = 0; c <= lastItems.length - span; c++){
							spanHeights[c] = Math.max.apply(Math, lastHeights.slice(c, c+span))
							if (spanHeights[c] < minH){
								minCol = c;
								minH = spanHeights[c];
							}
						}
					}
					//Replace priorities
					for (c = 0; c < colPriority.length; ){
						if (colPriority[c] >= minCol && colPriority[c] < minCol + span){
							spanCols.push(colPriority.splice(c, 1)[0])
						} else {c++}
					}
				}

				//console.log(spanCols)
				//console.log("minCol:"+minCol+" minH:"+minH)
				//console.log(lastHeights)

				//console.log("↑ spanCols to ↓")

				style = getComputedStyle(e);

				e.style.width = colW * span - parseInt(style.marginRight) - parseInt(style.marginLeft);
				e.style.top = minH;
				e.style.left = colW * minCol + self.pl;

				newH = self._getBottom(e);
				for (t = 0; t < spanCols.length; t++) {
					lastItems[spanCols[t]] = e;
					lastHeights[spanCols[t]] = newH;
				}
				//console.log(lastItems)
				//console.log("↑ lastHeights to ↓")
				//console.log(lastHeights)

				//console.log(colPriority)
				//console.log("↑ colPriorities to ↓")

				//Update colPriority
				for (c = colPriority.length; c--;){
					h = lastHeights[colPriority[c]];
					if (newH >= h){
						Array.prototype.splice.apply(colPriority, [c+1,0].concat(spanCols));
						break;
					}
				}
				if (colPriority.length < lastHeights.length){
					Array.prototype.unshift.apply(colPriority, spanCols)
				}
				//console.log(colPriority)
			}

			//Maximize height
			self.container[0].style.height = lastHeights[colPriority[colPriority.length - 1]] + self.pb;
		},

		_getBottom: function(e) {
			if (!e) return this.pt;
			var s = getComputedStyle(e);
			return parseInt(s.top) + e.clientHeight + parseInt(s.marginTop) + parseInt(s.marginBottom) + parseInt(s.borderTop) + parseInt(s.borderBottom);
		},

		_removeColumns: function(){
			var self = this, o = self.options;
			var items = $(self.items);
			items.detach();
			self.container.children().remove();
			self.container.append(items)
			return self;
		},
		
	})


	$.fn.waterfall = function (arg, arg2) {
		if (typeof arg == "string") {//Call API method
			return $(this).each(function (i, el) {
				$(el).data("waterfall")[arg](arg2);
			})
		} else {
			var $this = $(this),
			opts = $.extend({},$.parseDataAttributes(this[0]),arg);
			if (opts.width && !opts.colMinWidth) {
				opts.colMinWidth = opts.width
			}
			var wf = new Waterfall($this, opts);
			if (!$this.data("waterfall")) $this.data("waterfall", wf);
			return wf;
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

	//autostart
	$(function () {
		var defClass = window.waterfall && window.waterfall.defaultClass || Waterfall.defaultClass;

		$("." + defClass).each(function (i, e){
			var $e = $(e),
				opts = window.waterfall || {};
			$e.waterfall(opts);
		});
	})

})(window.jQuery || window.Zepto);