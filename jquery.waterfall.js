/*
Simple min-height-masonry layout plugin.
Like masonry column shift, but works.
*/
;(function ($){
	var $wnd = $(window),
		$doc = $(window.document),
		$body = $(window.document.body);

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
			updateDelay: 50,
			waitLoad: true //whether to show new items after load images inside
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts);

			//init some vars
			self.lastHeights = [];
			self.lastItems = [];
			self.colPriority = []; //most left = most minimal column
			self.baseOrder = [];

			cStyle = getComputedStyle(self.container[0]);
			self.container[0].style.minHeight = cStyle.height; //prevent scrollbar width changing
			if (self.container.css("position") === "static" ) self.container[0].style.position = "relative";

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

			//observe changes in container by default
			self.container.on("DOMNodeInserted", function(e){
				//console.log(e.originalEvent)
				var el = e.originalEvent.target;

				el.style.position = "absolute";
				el.style.top = self.lastHeights[self.colPriority[self.colPriority.length - 1]];				
				self.lastItem = self.items.push(el);

				self._initItem(el);
			})
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
		add: function (itemSet, dfdShow, cb) {
			var self = this, o = self.options;

			itemSet = $(itemSet);
			var df = document.createDocumentFragment();

			//prepare elements
			var top = self.lastHeights[self.colPriority[self.colPriority.length - 1]] + "px";
			itemSet.each(function(i,el){
				el.style.position = "absolute";
				el.style.top = top;
				self.items.push(el);
				df.appendChild(el);
			})

			self.container[0].appendChild(df);
			self.lastItem = self.items[self.items.length-1];

			self._initItem();

			return self;
		},

		_initItem: function(itemSet){
			var self = this, o = self.options;

			itemSet = $(itemSet);

			//Correct elements
			var scrollBottom = $doc.scrollTop() + $wnd.height();
			itemSet.each(function (i, el) {
				var	dfdShow = dfdShow || o.waitLoad && el.querySelector("img, iframe, object");

				if (dfdShow){
					var displace = scrollBottom - el.offsetTop;
					el.style["-webkit-transform"] = "translate(0, " + displace + "px)";
					$(el).find("img").load(function(e){
						self._placeItem(el);
						el.style["-webkit-transition"] = "-webkit-transform .5s";
						el.style["-webkit-transform"] = "translate(0, 0px)";
						self._maximizeHeight();
					})
				} else {
					self._placeItem(el);
					self._maximizeHeight();
				}
			})
		},


		//========================= Techs
		_initVars: function(){
			var self = this, o = self.options,
				cStyle = getComputedStyle(self.container[0]),
				i = 0;

			self.pl = ~~(cStyle["padding-left"].slice(0,-2));
			self.pt = ~~(cStyle["padding-top"].slice(0, -2));
			self.pr = ~~(cStyle["padding-right"].slice(0, -2));
			self.pb = ~~(cStyle["padding-bottom"].slice(0, -2));

			self.lastHeights.length = 0;
			self.lastItems = [];
			self.colPriority.length = 0; //most left = most minimal column
			self.baseOrder.length = 0;
			self.lastHeights.length = 0;

			self.colWidth = self.container[0].clientWidth - self.pl - self.pr;

			self.lastItems.length = ~~(self.colWidth / o.colMinWidth) || 1; //needed length

			for (i = 0; i < self.lastItems.length; i++){
				self.lastHeights.push(self.pt);
				self.baseOrder.push(i);
				self.colPriority.push(i);
			}

			self.colWidth /= self.lastItems.length;
		},

		//full update of layout
		_update: function(from, to){
			var self = this, o = self.options,
				e = self.items[0],
				i = 0,
				start = from || 0,
				end = to || self.items.length;

			self._initVars();

			for (i = start; i < end; i++){
				self._placeItem(self.items[i]);				
			}

			self._maximizeHeight();
		},

		_placeItem: function(e){
			var self = this;

			var lastHeights = self.lastHeights,
				lastItems = self.lastItems,
				colPriority = self.colPriority,
				minCol = 0, minH = 0,
				h = 0, c = 0, t = 0, end = 0, start = 0,
				span = 1,
				newH = 0,
				spanCols = [],
				spanHeights = [],
				style,
				float = e.getAttribute("data-float") || e.getAttribute("data-column"),
				floatCol = 0;

			span = e.getAttribute("data-span") || 1;
			span = (span === "all" ? lastItems.length : Math.max(0,Math.min( ~~(span), lastItems.length)));
			spanCols.length = 0;

			//console.log("------ item")
			//console.log("span:"+span)

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
					floatCol = Math.max(Math.min(lastHeights.length - span, ~~(float)), 0);
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
				spanCols = self.baseOrder.slice();
				spanCols.length = lastHeights.length;
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
			//console.log(lastHeights)
			//console.log("↑ spanCols to ↓")

			style = getComputedStyle(e);

			//self.itemHMargins =  + ;
			e.style.width = self.colWidth * span - ~~(style["margin-right"].slice(0, -2)) - ~~(style["margin-left"].slice(0, -2));
			e.style.top = minH;
			e.style.left = self.colWidth * minCol + self.pl;

			newH = self._getBottom(e); //this is the most difficult operation (e.clientHeight)
			for (t = 0; t < spanCols.length; t++) {
				lastItems[spanCols[t]] = e;
				self.lastHeights[spanCols[t]] = newH;
			}

			//console.log(lastItems)
			//console.log("↑ self.lastHeights to ↓")
			//console.log(self.lastHeights)
			//console.log("minCol:"+minCol+" minH:"+minH+" newH:"+newH)
			//console.log(colPriority)
			//console.log("↑ colPriorities to ↓")

			//Update colPriority
			for (c = colPriority.length; c--;){
				h = self.lastHeights[colPriority[c]];
				if (newH >= h){
					Array.prototype.splice.apply(colPriority, [c+1,0].concat(spanCols));
					break;
				}
			}
			if (colPriority.length < lastHeights.length){
				Array.prototype.unshift.apply(colPriority, spanCols)
				//self.colPriority = spanCols.concat(colPriority)
			}
		},

		_getBottom: function(e) {
			if (!e) return this.pt;
			var itemStyle = getComputedStyle(e);
			return e.offsetTop 
					+ e.clientHeight
					+ ~~(itemStyle["border-top-width"].slice(0, -2)) 
					+ ~~(itemStyle["border-bottom-width"].slice(0, -2))
					//+ ~~(itemStyle["margin-top"].slice(0, -2)) //ignored because of offsetTop instead of style.top
					+ ~~(itemStyle["margin-bottom"].slice(0, -2)); 
		},

		_removeColumns: function(){
			var self = this, o = self.options;
			var items = $(self.items);
			items.detach();
			self.container.children().remove();
			self.container.append(items)
			return self;
		},

		_maximizeHeight: function(){
			this.container[0].style["min-height"] = this.lastHeights[this.colPriority[this.colPriority.length - 1]] + this.pb;
		}
		
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