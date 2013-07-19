/*
Simple min-height-masonry layout plugin.
Like masonry column shift, but works.
*/
;(function ($){
	var Waterfall = function (el, opts){
		this.element = $(el);
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
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts);

			self.container = self.element;

			self.container[0].style.height = self.container.css("height"); //prevent scrollbar width changing
			if (self.container.css("position") === "static" ) self.container[0].style.position = "relative";

			self.items = [];
			self.columns = []; //array of arrays of elements = waterfall model. Spanning elements may present in both ajacent arrays.
			self.prevItems = {}; //map of itemId - [prevel1, prevel2, ..]

			var colClass = o.colClass ? o.colClass : 'wf-column';
			if (self.container.children().hasClass(colClass)) {
				//Columns init — keep initial order of items
				var cols = $('.' + colClass, self.container),
					children = $('.' + colClass, self.container).children();
				var i = 0, end = children.length * cols.length;
				while (self.items.length < children.length && i < end) {
					var el = cols.eq(i%3).children()[Math.floor(i/3)];
					if (el) self.items.push($(el));
					i++;
				}
			} else {
				//Items init
				self.container.children().each(function(i,e){
					self.items.push($(e));
				});
			}

			self.lastItem = self.items[self.items.length-1]
			self.firstItem = self.items[0]
			
			self._removeColumns();
			
			for (var i = self.items.length; i--;){
				self.items[i].data("id", i);
				self.items[i][0].style.position = "absolute";
			}

			o.colMinWidth = opts.colMinWidth || o.colMinWidth;

			self.reflow();

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
		reflow: function () {
			var self = this, o = self.options,
				neededCols = self._countNeededColumns();

			if (neededCols != self.columns.length) {
				self._ensureColumns(neededCols)._redistribute();
			} else {				
				//$(self.items).detach();
				self._updateSizes();
			}

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
			self.container.append(self.items)
			return self;
		},

		//ensures only number of columns exist
		_ensureColumns: function (num) {
			var self = this, o = self.options
				num = num || 1;

			if (self.columns.length < num) {
				var str = '';
				var colNum = self.columns.length;
				for (var i = 0; i < num - colNum; i++ ){
					//str += self._columnTpl();
					self.columns.push([]);
				}

			} else if ( self.columns.length > num) {
				self.columns.length = num;
			}

			return self;
		},

		_columnTpl: function () {
			return '<div class="wf-column ' + (this.options.colClass || '')  + '"></div>';
		},

		_clearClasses: function(){
			var self = this;
			for (var i = 0; i < self.items.length; i++){
				self.items[i].removeClass("wf-column-last wf-column-first wf-column-" + self.items[i].data("colNum"))
			}
		},

		_calcColWidth: function(){
			var self = this;			
			self.pl = parseInt(self.container.css("padding-left"))
			self.pt = parseInt(self.container.css("padding-top"))
			self.pr = parseInt(self.container.css("padding-right"))
			self.pb = parseInt(self.container.css("padding-bottom"))
			self.colWidth = (self.container.innerWidth() - self.pl - self.pr) / self.columns.length;
		},

		//Redistributes items by columns
		_redistribute: function () {
			var self = this, o = self.options;
			
			for (var i = self.columns.length; i--;){
				self.columns[i].length = 0;
			}

			self._clearClasses();

			self._calcColWidth();

			//place each item in proper column
			$.each(self.items, function (i, $e) {
				var col = $e.data("float") || $e.data("column"),
					span = $e.data("span");

				span = (span == "all" ? self.columns.length : Math.min( span || 1, self.columns.length));

				if (col){
					switch(col){
						case "left":
						case "first":
							self._insertToColumn(0, $e, span);
							break;
						case "last":
							//console.log(i);
							self._insertToColumn(self.columns.length - 1, $e, span);
							break;							
						case "right":
							self._insertToColumn(self.columns.length - span, $e, span);
							break;
						default:
							self._insertToColumn(Math.max(Math.min(col, self.columns.length) - 1, 0), $e, span);
					}
				} else {
					self._insertToColumn(self._getMinCol(), $e, span);
				}
			});

			self._maximizeContainerHeight();

			return self;
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
			
		},

		_setItemPosition: function(colNum, $e, span){
			var self = this;
			$e[0].style.left = self.colWidth * colNum + self.pl + "px";
			$e[0].style.width = self.colWidth * span - parseInt($e.css("margin-right"))- parseInt($e.css("margin-left")) + "px";
			$e[0].style.top = self._getMaxHeight(self.prevItems[$e.data("id")]) + "px";
		},

		_updateSizes: function(){
			var self = this, o = self.options;

			self._calcColWidth();

			for (var i = 0; i < self.columns.length; i++){
				for (var j = 0; j < self.columns[i].length; j++){
					var $e = self.columns[i][j];
					if ($e !== null) self._setItemPosition($e.data("colNum"), $e, $e.data("spanNum"));
				}
			}

			self._maximizeContainerHeight();

			return self;
		},

		//get bottom of element
		_getBottom: function($e) {
			var self = this;
			lastHeight = $e && $e[0].clientHeight || 0,
			lastTop = $e && parseInt($e[0].style.top) || 0;
			return lastTop + lastHeight + ($e && (parseInt($e.css("margin-bottom")) + parseInt($e.css("margin-top"))) || 0);
		},

		//returns column with minimal height
		_getMinCol: function () {
			var self = this, minH = Infinity, minCol = self.columns[0], minColNum = 0;

			//fill min heights
			for (var i = 0; i < self.columns.length; i++){
				var $e = self.columns[i][self.columns[i].length - 1];
				var h = self._getBottom($e);
				if (h < minH) {
					minH = h;
					minColNum = i;
				}
			}
			return minColNum;
		},

		_getLastItems: function(a,b){
			var self = this, items = [], start = a || 0, end = b || self.columns.length;
			for (var i = start; i < end; i++){
				var $e = self.columns[i][self.columns[i].length - 1]
				items.push($e);
			}
			return items;
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

		_maximizeContainerHeight: function(){
			var self = this, maxH = 0, h = 0;
			for (var i = self.columns.length; i--;){
				h = self._getBottom(self.columns[i][self.columns[i].length - 1]);
				if (h > maxH){
					maxH = h;
				}
			}
			self.container[0].style.height = maxH + self.pb;
		},
		
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