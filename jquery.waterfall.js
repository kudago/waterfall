/*
Simple min-height-masonry layout plugin.
Like masonry column shift, but works.
*/
;(function ($){
	var $wnd = $(window),
		$doc = $(window.document),
		$body = $(window.document.body),
		cssPrefix = detectCSSPrefix();

	var Waterfall = function (el, opts){
		this.$el = $(el);
		this.el = el[0];
		this._create(opts)
	}

	Waterfall.defaultClass = "waterfall";

	$.extend(Waterfall.prototype, {
		options: {
			colMinWidth: 300,
			defaultContainerWidth: window.clientWidth,
			colClass: null,
			autoresize: true,
			order: "waterfall", //TODO: columns order, like css3 columns
			maxCols: 16,
			updateDelay: 25,
			maximizeHeightInterval: 20,
			evSuffix: "waterfall",
			useCalc: true, //TODO: test if acceptable
			useTranslate3d: true, //TODO: the same as above
			animateShow: false, //whether to animate appending items

			itemInserted: null, //before set item position
			itemPlaced: null, //before calc item's height
			initItems: null, //called on initial items comprehensed (before placing them)
			reflow: null
		},

		_create: function (opts) {
			var self = this,
			o = self.options = $.extend({}, self.options, opts);

			this.evSuffix = "." + o.evSuffix;

			//init some vars
			self.lastHeights = [];
			self.lastItems = [];
			self.colPriority = []; //most left = most minimal column
			self.baseOrder = [];

			var cStyle = getComputedStyle(self.el);
			self.el.style.minHeight = cStyle.height; //prevent scrollbar width changing
			if (self.$el.css("position") === "static" ) self.el.style.position = "relative";

			var colClass = o.colClass ? o.colClass : 'wf-column';
			if (self.$el.children().hasClass(colClass)) {
				self.items = []
				//Columns init — keep initial order of items
				var cols = $('.' + colClass, self.$el),
					children = $('.' + colClass, self.$el).children();
				var i = 0, end = children.length * cols.length;
				while (self.items.length < children.length && i < end) {
					var el = cols.eq(i%3).children()[Math.floor(i/3)];
					if (el) self.items.push(el);
					i++;
				}
				self._removeColumns();
			} else {
				self.items = self.el.children;
			}

			self.lastItem = self.items[self.items.length-1]
			self.firstItem = self.items[0]
						
			for (var i = self.items.length; i--;){
				//self.items[i].data("id", i);
				self._initItem(self.items[i]);
			}

			//self._trigger('initItems', self.items);

			self._update();

			if (o.autoresize) {
				$(window).resize(self.reflow.bind(self))
			}
		
			//Make Node changing observer - the fastest way to add items
			this.observer = new MutationObserver(function(mutations){
				//console.log(mutations)
				var addedNodes = Array.prototype.slice.apply(mutations[0].addedNodes),
					l = addedNodes.length;
				for (var i = 0; i < l; i++ ){
					var el = addedNodes[i];
					if (el.nodeType !== 1) continue;
					self.items.push(el);
					this._initItem(el); //TODO: optimize					
					if (o.animateShow) {
						if (o.useTranslate3d){
							//TODO: this below crashes on chrome
							//el.style[cssPrefix+"translate"] = "translate3d(0, " + this.lastHeights[this.colPriority[0]] + "px ,0)"
						} else {
							el.style.top = this.lastHeights[this.colPriority[this.colPriority.length-1]] + "px";
							el.style.left = this.colWidth * this.colPriority[this.colPriority.length-1] + "px";							
						}
						el.removeAttribute("hidden");
					}
				}
				for (var i = 0; i < l; i++){
					this._placeItem(addedNodes[i])
				}
				self.lastItem = self.items[self.items.length - 1];
				this._maximizeHeight();
			}.bind(this));

			this.observer.observe(this.el, { 
				attributes: false, 
				childList: true, 
				characterData: false 
			});
		},



		//==========================API
		//Ensures column number correct, reallocates items
		_updateInterval: 0,
		reflow: function () {
			var self = this, o = self.options;

			window.clearTimeout(self._updateInterval);
			self._updateInterval = window.setTimeout(self._update.bind(self), o.updateDelay);

			return self;
		},

		//========================= Techs
		//simple trigger routine
		_trigger: function(cbName, arg){
			try {
				if (this.options[cbName]) this.options[cbName].call(this.$el, arg);
				this.$el.trigger(cbName, [arg])
			} catch (err){
				throw (err);
			}
		},

		//init item properties once item appended
		_initItem: function(el){
			var o = this.options;
			//parse span
			var	span = el.getAttribute("data-span") || 1;
			span = (span === "all" ? o.maxCols : Math.max(0,Math.min( ~~(span), o.maxCols)));
			el.span = span; //quite bad, but no choice: dataset is sloow

			//save heavy style-attrs
			var style = getComputedStyle(el);
			el.mr = ~~(style.marginRight.slice(0, -2))
			el.ml = ~~(style.marginLeft.slice(0, -2))
			el.bt = ~~(style.borderTopWidth.slice(0, -2)) 
			el.bb = ~~(style.borderBottomWidth.slice(0, -2))
			el.mt = ~~(style.marginTop.slice(0, -2)) //ignored because of offsetTop instead of style.top
			el.mb = ~~(style.marginBottom.slice(0, -2)); 

			//set style
			el.style.position = "absolute";
			this._setItemWidth(el);

			//parset float
			var float = el.getAttribute("data-float") || el.getAttribute("data-column");
			switch (float){
				case null: //no float
					el.floatCol = null;
					break;
				case "right":
				case "last":
					el.floatCol = -span;
					break;
				case "left":
				case "first":
					el.floatCol = 0;
					break;
				default: //int column
					el.floatCol = ~~(float) - 1;
					break;
			}
		},

		_initLayoutParams: function(){
			var self = this, o = self.options,
				cStyle = window.getComputedStyle(self.el),
				i = 0,
				prevCols = self.lastItems.length;

			self.pl = ~~(cStyle.paddingLeft.slice(0,-2));
			self.pt = ~~(cStyle.paddingTop.slice(0, -2));
			self.pr = ~~(cStyle.paddingRight.slice(0, -2));
			self.pb = ~~(cStyle.paddingBottom.slice(0, -2));

			self.lastHeights.length = 0;
			self.colPriority.length = 0; //most left = most minimal column
			self.baseOrder.length = 0;

			self.colWidth = self.el.clientWidth - self.pl - self.pr;

			self.lastItems.length = ~~(self.colWidth / o.colMinWidth) || 1; //needed length

			//console.log(prevCols + "->" + self.lastItems.length);
			if (!o.useCalc || prevCols !== self.lastItems.length) {
				//set item widths carefully - if columns changed or px widths used
				for (var i = self.items.length; i--;){
					this._setItemWidth(self.items[i]);
				}
			}

			var top = o.useTranslate3d?0:self.pt;
			for (i = 0; i < self.lastItems.length; i++){
				self.lastHeights.push(top);
				self.baseOrder.push(i);
				self.colPriority.push(i);
			}

			self.colWidth /= self.lastItems.length;

			return self.lastItems.length;
		},

		//full update of layout
		_update: function(from, to){
			//window.start = Date.now()
			var self = this, o = self.options,
				i = 0,
				start = from || 0,
				end = to || self.items.length,
				colsNeeded = self._initLayoutParams();

			//console.log("beforePlace:" + this.lastItems.length)
			for (i = start; i < end; i++){
				self._placeItem(self.items[i]);
			}
			//console.log("afterPlace:" + this.lastItems.length)

			self._maximizeHeight();
			self._trigger('reflow');
			//console.log("time elapsed: " + (Date.now() - window.start) + "ms")
		},

		//set item width based on span/colWidth
		_setItemWidth: function(el){
			var span = el.span > this.lastItems.length ? this.lastItems.length : el.span,
				cols = this.lastItems.length,
				colWeight = span/cols;
			if (this.options.useCalc){
				el.w = (100 * colWeight);
				el.style.width = "calc(" + el.w + "% - " + (el.mr + el.ml + (this.pl + this.pr) * colWeight) + "px)";
			} else {
				el.w = ~~(this.colWidth * span - (el.ml - el.mr))
				el.style.width =  el.w + "px";
			}
		},

		_placeItem: function(e){
			var self = this, o = self.options;

			var lastHeights = self.lastHeights,
				lastItems = self.lastItems,
				colPriority = self.colPriority,
				minCol = 0, minH = 0,
				h = 0, c = 0, t = 0, end = 0, start = 0,
				span = e.span > lastItems.length ? lastItems.length : e.span,
				newH = 0,
				spanCols = [], //numbers of spanned columns
				spanHeights = [], //heights of spanned columns
				style,
				floatCol = e.floatCol;

			//console.log("------ item")
			//console.log("span:"+span)			

			//Find proper column to place item
			//console.log(colPriority)
			if (floatCol){
				floatCol = floatCol > 0 ? Math.min(floatCol, lastItems.length - span) : (lastItems.length + floatCol);
			}
			if (span === 1){
				//Single-span element
				if (floatCol === null){
					//no align
					minCol = colPriority.shift();
				} else {
					//predefined column to align
					minCol = floatCol;
					for (c = 0; c < colPriority.length; c++){
						if (colPriority[c] == minCol){
							colPriority.splice(c, 1);
							break;
						}
					}
				}
				spanCols.push(minCol);
				minH = lastHeights[minCol];
			} else if (span >= lastItems.length){//Full-span element
				minCol = 0;
				minH = lastHeights[colPriority[colPriority.length - 1]];
				spanCols = self.baseOrder.slice();
				spanCols.length = lastHeights.length;
				colPriority.length = 0;
			} else {//Some-span element
				if (floatCol !== null){
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

			//TODO: correct to work ok with options
			e.top = ~~minH; //stupid save value for translate3d
			if (o.useTranslate3d) {
				var offset = (100 * minCol/span) + "% + " + ~~((e.ml + e.mr) * minCol/span) + "px";
				e.style[cssPrefix + "transform"] = "translate3d(calc(" + offset + "), " + e.top + "px, 0)";
				//e.style[cssPrefix + "transform"] = "translate3d(" + ~~(self.colWidth * minCol + self.pl) + "px, " + e.top + "px, 0)";			
			} else {
				e.style.top = e.top + "px";
				e.style.left = self.colWidth * minCol + self.pl + "px";
			}

			//if element was added first time and is out of flow - show it
			//e.style.opacity = 1;
			e.removeAttribute("hidden")

			//self._trigger('itemPlaced', e);

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
			if (!e) return 0//this.pt;
			//TODO: memrize height, look for height change to avoid reflow
			return e.top + e.clientHeight + e.bt + e.bb + e.mb + e.mt;
		},

		_removeColumns: function(){
			var self = this, o = self.options;
			var items = $(self.items);
			items.detach();
			self.$el.children().remove();
			self.$el.append(items)
			return self;
		},

		_maximizeHeight: function(){
			var top = this.options.useTranslate3d ? this.pt : 0;
			this.el.style.minHeight = this.lastHeights[this.colPriority[this.colPriority.length - 1]] + this.pb + top + "px";
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

	//stupid prefix detector
	function detectCSSPrefix(){
		var style = document.defaultView.getComputedStyle(document.body, "");
		if (style["transform"]) return "";
		if (style["-webkit-transform"]) return "-webkit-";
		if (style["-moz-transform"]) return "-moz-";
		if (style["-o-transform"]) return "-o-";
		if (style["-khtml-transform"]) return "-khtml-";
		return "";
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