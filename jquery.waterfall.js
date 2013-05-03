/*
Simple min-height-masonry layout plugin.
Like masonry column shift, but works.
*/
(function ($){
	var Waterfall = function (el, opts){
		this.element = $(el);
		this._create(opts)
	}

	$.extend(Waterfall.prototype, {
		options: {
			itemSelector: null,
			colMinWidth: 300,
			defaultContainerWidth: $(window).width(),
			colClass: null,
			autoresize: false
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts);

			self.container = self.element;
			self.items = o.itemSelector ? $(o.itemSelector, self.container) : self.container.children();
			self.items.detach();

			//save min width
			o.colMinWidth = parseInt(self.items.css("min-width")) || o.colMinWidth;
			//console.log(window.getComputedStyle(self.items[0])["width"])
			self.reflow();

			if (o.autoresize) {
				$(window).resize(self.reflow.bind(self))
			}
		},

		//==========================API
		//Ensures column number correct, reallocates items
		reflow: function () {
			var self = this, o = self.options,
				neededCols = self._countNeededColumns();
			if (neededCols == self.container.children().length) return;
			self.items.detach();
			self._ensureColumns(neededCols)._refill();

			return self;
		},

		//Inserts new item(s)
		add: function (itemSet) {
			var self = this, o = self.options, cols = self.container.children();

			itemSet.each(function (i, el) {
				var $item = $(el);
				self._getMinCol(cols).append($item);
			})

			self.items = self.items.add(itemSet);
			return self;
		},


		//========================= Techs

		//calc needed number of columns
		_countNeededColumns: function () {
			var self = this, o = self.options;
			return ~~((self.container.width() || o.defaultContainerWidth) / o.colMinWidth) || 1;
		},

		//ensures only number of columns exist
		_ensureColumns: function (num) {
			var self = this, o = self.options
				num = num || 1,
				columns = self.container.children();

			if (columns.length < num) {
				for (var i = 0; i < num - columns.length; i++ ){
					self.container.append(self._columnTpl());
				}
			} else if ( columns.length > num) {
				columns.slice(- columns.length + num).remove();
			}

			columns = self.container.children();
			columns.css({
				"width": 100 / columns.length +"%",
				"display": "inline-block",
				"vertical-align": "top"
			})
			return self;
		},

		_columnTpl: function () {
			return '<div class="wf-column ' + (this.options.colClass || '')  + '"></div>';
		},

		//Redistributes items by columns
		_refill: function () {
			var self = this, o = self.options;

			//for each item place it correctly
			self.items.each(function (i, el) {
				var $e = $(el),
					col = $e.data("float") || $e.data("column");
				if (col){
					switch(col){
						case "left":
						case "first":
							self.container.children().first().append($e)
							break;
						case "right":
						case "last":
							self.container.children().last().append($e)
							break;
						default:
							self.container.children().eq(Math.min(col-1, self.container.children().length)).append($e)
					}
				} else {
					self._getMinCol(self.container.children()).append($e);
				}
			})

			return self;
		},

		//returns column with minimal height
		_getMinCol: function (cols) {
			var minH = Infinity, minCol = cols.first(), minColNum = 0;

			//fill min heights
			cols.each(function (colNum, col){
				var $col = $(col);

				var h = $col.height();
				if (h < minH) {
					minH = h;
					minColNum = colNum;
				}
			});

			return cols.eq(minColNum);
		},

		
	})


	$.fn.waterfall = function (opts) {
		return $(this).each(function (i, el) {
			if (!$(el).data("waterfall")) $(el).data("waterfall", new Waterfall(el, opts));
		})
	}

	//Simple options parser. The same as $.fn.data(), but for zepto
	function parseOptions(el){
		//TODO: find camel-case transformer
	}


	$(function () {
		$(".waterfall").each(function (i, e){
				var $e = $(e),
					opts = parseOptions(e);
				$e.waterfall(opts);
			});
		})

})(jQuery || $)