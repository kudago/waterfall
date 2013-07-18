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
			mode: "absolute" //TODO: floats, columns
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts);

			self.container = self.element;

			if (o.mode == "absolute"){
				self.container[0].style.position = "relative";
			}

			self.columns = [[]]; //array of arrays of elements = waterfall model. Spanning elements may present in both ajacent arrays.

			var colClass = o.colClass ? o.colClass : 'wf-column';
			if (self.container.children().hasClass(colClass)) {
				//Columns init — keep initial order of items
				var cols = $('.' + colClass, self.container),
					children = $('.' + colClass, self.container).children();				
				self.items = [];
				var i = 0, end = children.length * cols.length;
				while (self.items.length < children.length && i < end) {
					var el = cols.eq(i%3).children()[Math.floor(i/3)];
					if (el) self.items.push($(el));
					i++;
				}
			} else {
				//Items init
				self.items = [];
				self.container.children().each(function(i,e){
					self.items.push($(e));
				});
			}

			if (o.mode == "absolute"){				
				for (var i = self.items.length; i--;){
					self.items[i][0].style.position = "absolute";
				}
			}

			self.lastItem = self.items[self.items.length-1]
			self.firstItem = self.items[0]
			
			self._removeColumns();
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
			this._resetColumns().reflow();
			return this;
		},
		setOptions: function (opts) {
			this.options = $.extend(this.options, opts);
			this._resetColumns().reflow()
			return this;
		},

		//Ensures column number correct, reallocates items
		reflow: function () {
			var self = this, o = self.options,
				neededCols = self._countNeededColumns();

			if (neededCols == self.columns.length) {
				self._updateWidths();
				return;
			} //prevent recounting if columns enough

			//$(self.items).detach();
			self._ensureColumns(neededCols)._refill();

			return self;
		},

		//Inserts new item(s)
		add: function (itemSet) {
			var self = this, o = self.options, cols = self.container.children();

			itemSet = $(itemSet);

			itemSet.each(function (i, el) {
				var $item = $(el);
				self._getMinCol(cols).append($item);
				self.items.push($item)
			})

			self.lastItem = self.items[self.items.length-1]

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
			if (o.mode == "absolute"){
				self.container.append(self.items)
			}	
			return self;
		},

		//ensures only number of columns exist
		_ensureColumns: function (num) {
			var self = this, o = self.options
				num = num || 1;
				//columns = self.container.children();

			if (self.columns.length < num) {
				var str = '';
				var colNum = self.columns.length;
				for (var i = 0; i < num - colNum; i++ ){
					//str += self._columnTpl();
					self.columns.push([]);
				}
				//self.container.append(str);
			} else if ( self.columns.length > num) {
				self.columns.length = num;
			}

			for (var i in self.columns){
				self.columns[i].length = 0;
			}
			//TODO: ensure that in columns mode real number of columns exists in DOM

			//self.columns = self.container.children();
			//columns.css({
			//	"width": 100 / columns.length +"%",
			//	"display": "inline-block",
			//	"vertical-align": "top"
			//})

			return self;
		},

		_columnTpl: function () {
			return '<div class="wf-column ' + (this.options.colClass || '')  + '"></div>';
		},

		//do not recount columns
		_updateWidths: function(){
			var self = this, o = self.options;
			console.log("update widths")
		},

		//Redistributes items by columns
		_refill: function () {
			var self = this, o = self.options;

			self.colWidth = self.container.width() / self.columns.length;

			//place each item in proper column
			$.each(self.items, function (i, $e) {
				var col = $e.data("float") || $e.data("column"),
					span = $e.data("span");

				span = span == "all" ? self.columns.length : Math.min( span || 1, self.columns.length);

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
			})

			self._maximizeContainerHeight();

			return self;
		},

		_insertToColumn: function(colNum, $e, span) {
			var self = this, o = self.options;

			span = Math.min(self.columns.length - colNum, span);		

			switch (o.mode){
				case "floats":
					break;
				case "columns":
					break;
				default:
					$e[0].style.left = self.colWidth * colNum + "px";
					$e[0].style.width = self.colWidth * span + "px";
					var maxCol = self._getMaxCol(self.columns.slice(colNum, colNum + span))
					$e[0].style.top = self._getBottom(maxCol[maxCol.length - 1]) + "px";

					for (var i = 0; i < span; i++){
						self.columns[colNum + i].push($e);
					}

					break;
			}
		},

		//get bottom of element
		_getBottom: function($e) {
			lastHeight = $e && parseInt($e[0].clientHeight) || 0,
			lastTop = $e && parseInt($e[0].style.top) || 0;
			return lastTop + lastHeight;
		},

		//returns column with minimal height
		_getMinCol: function () {
			var self = this, minH = Infinity, minCol = self.columns[0], minColNum = 0;

			//fill min heights
			for (var i = 0; i < self.columns.length; i++){
				var $e = self.columns[i][self.columns[i].length - 1]
				var h = self._getBottom($e);
				if (h < minH) {
					minH = h;
					minColNum = i;
				}
			}
			return minColNum;
		},

		_maximizeContainerHeight: function(){
			var self = this, maxH = 0, h = 0;
			for (var i = self.columns.length; i--;){
				h = self._getBottom(self.columns[i][self.columns[i].length - 1]);
				if (h > maxH){
					maxH = h;
				}
			}
			self.container[0].style.height = maxH;
		},

		_getMaxCol: function(cols){
			var self = this, maxH = 0, h = 0, maxColNum = 0;
			for (var i = cols.length; i--;){
				if (cols[i].length < 1) continue;
				h = self._getBottom(cols[i][cols[i].length - 1]);
				if (h > maxH){
					maxH = h;
					maxColNum = i;
				}
			}
			return cols[maxColNum];
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