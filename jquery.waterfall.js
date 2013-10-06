/* Simple min-height-masonry layout plugin.
Like masonry column shift, but works. */
;(function($) {

	'use strict';

	var cssPrefix = detectCSSPrefix();

	var Waterfall = function(el, opts) {
		this.$el = $(el);
		this.el = el[0];
		this._create(opts);
	};

	Waterfall.defaultClass = 'waterfall';

	$.extend(Waterfall.prototype, {
		options: {
			colMinWidth: 300, //width of column, used to calculate number of columns possible to display
			defaultContainerWidth: window.clientWidth,
			autoresize: true,
			maxCols: 16, //used to restrict max number of columns
			updateDelay: 45, //how often to reflow layout on window resize
			useCalc: undefined, //set width through -prefix-calc value. Values: true, false, undefined. Autodetection.
			useTranslate3d: undefined, //place items through translate3d instead of top/left. Values: true, false, undefined. Autodetection
			animateShow: false, //whether to animate appending items (causes browser extra-reflows, slows down rendering)

			//callbacks
			reflow: null
		},

		_create: function(opts) {
			var self = this,
				o = self.options = $.extend({}, self.options, opts);

			this.items = [];

			//init some vars
			self.lastHeights = [];
			self.lastItems = [];
			self.colPriority = []; //most left = most minimal column
			self.baseOrder = [];

			var cStyle = getComputedStyle(self.el);
			self.el.hidden = true;
			self.el.style.minHeight = cStyle.height; //prevent scrollbar width changing
			if (self.$el.css('position') === 'static') self.el.style.position = 'relative';

			//detect placing mode needed
			if (o.useCalc === undefined) {
				//transform calc detect
				this.prefixedCalc = (function() {
					var dummy = document.createElement('div'),
						props = ['calc', '-webkit-calc', '-moz-calc', '-o-calc'];
					for (var i = 0; i < props.length; ++i) {
						var prop = props[i], propStr =  prop + '(1px)';
						dummy.style.cssText = cssPrefix + 'transform: translate3d(' + [propStr, propStr, propStr].join(',') +');';
						//console.log(dummy.style[cssPrefix + 'transform'])
						if (dummy.style.length && dummy.style[cssPrefix + 'transform'].length > 14) {
							return prop;
						}
					}
				})();
				o.useCalc = !!this.prefixedCalc;
			}
			//console.log(this.prefixedCalc);
			if (o.useTranslate3d === undefined) {
				this.prefixedTranslate3d = (function() {
					var dummy = document.createElement('div');
					var props = ['translate3d', '-webkit-translate3d', '-moz-translate3d', '-o-translate3d'];
					for (var i = 0; i < props.length; ++i) {
						var prop = props[i];
						dummy.style.cssText = cssPrefix + 'transform:' + prop + '(1px, 0, 0);';
						if (dummy.style.length)
							return prop;
					}
				})();
				o.useTranslate3d = !! this.prefixedTranslate3d;
			}
			//console.log(this.prefixedTranslate3d)

			//populate items
			var items;
			{
				items = self.$el.children();
			}

			//remove text nodes
			for (var i = 0; i < self.el.childNodes.length;){
				if (self.el.childNodes[i].nodeType !== 1){
					self.el.removeChild(self.el.childNodes[i]);
				} else i++;
			}

			items.each(function(i, e) {
				//self.items[i].data('id', i);
				self._addItem(e);
				self._initItem(e);
			});

			self.lastItem = self.items[self.items.length - 1];

			self.el.removeAttribute("hidden");

			self._update();

			if (o.autoresize) {
				$(window)
					.resize(self.reflow.bind(self));
			}

			this._observeMutations();
		},

		_addItem: function(item){
			if (item.getAttribute("data-exclude")) return;
			this.items.push(item);
		},

		_observeMutations: function() {
			//Make Node changing observer - the fastest way to add items
			if (window.MutationObserver) {
				//FF, chrome
				this.observer = new MutationObserver(function(mutations) {
					var mNum = mutations.length;
					for (var i = 0; i < mNum; i++) {
						//console.log(mutations[i])
						if (mutations[i].removedNodes.length) {
							this._removedItems(Array.prototype.slice.apply(mutations[i].removedNodes));
						}
						if (mutations[i].addedNodes.length) {
							var nodes = Array.prototype.slice.apply(mutations[i].addedNodes);
							if (mutations[i].nextSibling) {
								this._insertedItems(nodes);
							} else {
								this._appendedItems(nodes);
							}
						}
					}
				}.bind(this));

				this.observer.observe(this.el, {
					attributes: false,
					childList: true,
					characterData: false
				});
			} else {
				//opera, ie
				this.$el.on('DOMNodeInserted', function(e) {
					var evt = (e.originalEvent || e),
						target = evt.target;

					if (target.nodeType !== 1) return;
					if (target.parentNode !== this.el) return; //if insertee is below container
					//console.log("--------" + target.className + " next:" + target.nextSibling + " prev:" + target.previousSibling)

					if (target.previousSibling && target.previousSibling.span && (!target.nextSibling || !target.nextSibling.span)) {
						this._appendedItems([target]); //append specific case, times faster than _insertedItems
					} else {
						this._insertedItems([target]);
					}
				}.bind(this)).on('DOMNodeRemoved', function(e) {
					var el = (e.originalEvent || e).target;

					if (el.nodeType !== 1) return;
					if (el.parentNode !== this.el) return; //if insertee is below container

					this._removedItems([el]);
				}.bind(this));
			}
		},

		//==========================API
		//Ensures column number correct, reallocates items
		reflow: function() {
			var self = this,
				o = self.options;

			window.clearTimeout(self._updateInterval);
			self._updateInterval = window.setTimeout(self._update.bind(self), o.updateDelay);

			return self;
		},

		//========================= Techs
		//called by mutation observer
		_appendedItems: function(items) {
			var l = items.length,
				i = 0;
			//console.log("append: " + this.items.length)
			for (; i < l; i++) {
				var el = items[i];
				if (el.nodeType !== 1) continue;
				this._addItem(el);
				this._initItem(el); //TODO: optimize
				this._setItemWidth(el);
			}

			for (i = 0; i < l; i++) {
				this._placeItem(items[i]);
			}

			this.lastItem = this.items[this.items.length - 1];

			this._maximizeHeight();
		},

		//if new items inserted somewhere inside the list
		_insertedItems: function(items) {
			//console.log("insert: " + this.items.length)
			//clear old items
			this.items.length = 0;

			//init new items
			var l = items.length;
			for (var i = 0; i < l; i++) {
				var el = items[i];
				if (el.nodeType !== 1) continue;
				this._initItem(el); //TODO: optimize
				this._setItemWidth(el);
			}

			//reinit all items
			var children = this.el.childNodes,
				itemsL = children.length;

			for (var i = 0; i < itemsL; i++){
				if (children[i].nodeType !== 1) continue;
				if (!children[i].span) continue;
				this._addItem(children[i]);
			}
			this.lastItem = this.items[this.items.length - 1];

			this.reflow();
		},

		//called by mutation observer
		_removedItems: function(items) {
			var childItems = this.el.childNodes,
				cl = childItems.length;
			//console.log("before removed: " + this.items.length)

			//reinit items
			for (var i = 0; i < items.length; i++){
				this.items.splice(this.items.indexOf(items[i]), 1);
			}

			//console.log("after remove:" + this.items.length)
			this.lastItem = this.items[this.items.length - 1];

			this.reflow();
		},

		//simple trigger routine
		_trigger: function(cbName, arg) {
			try {
				if (this.options[cbName]) this.options[cbName].call(this.$el, arg);
				this.$el.trigger(cbName, [arg]);
			} catch (err) {
				throw (err);
			}
		},

		//init item properties once item appended
		_initItem: function(el) {
			var o = this.options,
				span = el.getAttribute('data-span') || 1,
				floatVal = el.getAttribute('data-float') || el.getAttribute('data-column');

			//set span
			span = (span === 'all' ? o.maxCols : Math.max(0, Math.min(~~(span), o.maxCols)));
			el.span = span; //quite bad, but no choice: dataset is sloow

			//save heavy style-attrs
			var style = getComputedStyle(el);
			el.mr = ~~(style.marginRight.slice(0, -2));
			el.ml = ~~(style.marginLeft.slice(0, -2));
			el.bt = ~~(style.borderTopWidth.slice(0, -2));
			el.bb = ~~(style.borderBottomWidth.slice(0, -2));
			el.mt = ~~(style.marginTop.slice(0, -2)); //ignored because of offsetTop instead of style.top
			el.mb = ~~(style.marginBottom.slice(0, -2));

			//set style
			el.style.position = 'absolute';
			//this._setItemWidth(el); //make it external action to not to init frominside create

			//parset float
			switch (floatVal) {
				case null: //no float
					el.floatCol = null;
					break;
				case 'right':
				case 'last':
					el.floatCol = -span;
					break;
				case 'left':
				case 'first':
					el.floatCol = 0;
					break;
				default: //int column
					el.floatCol = ~~(floatVal) - 1;
					break;
			}

			if (o.animateShow) {
				if (o.useTranslate3d) {
					//TODO: this below crashes chrome
					//el.style[cssPrefix+'translate'] = 'translate3d(0, ' + this.lastHeights[this.colPriority[0]] + 'px ,0)'
				} else {
					el.style.top = this.lastHeights[this.colPriority[this.colPriority.length - 1]] + 'px';
					el.style.left = this.colWidth * this.colPriority[this.colPriority.length - 1] + 'px';
				}
				el.removeAttribute('hidden');
			}
		},

		_initLayoutParams: function() {
			var self = this,
				o = self.options,
				cStyle = window.getComputedStyle(self.el),
				i = 0,
				prevCols = self.lastItems.length;

			self.pl = ~~(cStyle.paddingLeft.slice(0, -2));
			self.pt = ~~(cStyle.paddingTop.slice(0, -2));
			self.pr = ~~(cStyle.paddingRight.slice(0, -2));
			self.pb = ~~(cStyle.paddingBottom.slice(0, -2));

			self.lastHeights.length = 0;
			self.colPriority.length = 0; //most left = most minimal column
			self.baseOrder.length = 0;

			self.colWidth = self.el.clientWidth - self.pl - self.pr;

			self.lastItems.length = ~~(self.colWidth / o.colMinWidth) || 1; //needed length
			console.log(o.colMinWidth)

			var top = o.useTranslate3d ? 0 : self.pt;
			for (i = 0; i < self.lastItems.length; i++) {
				self.lastHeights.push(top);
				self.baseOrder.push(i);
				self.colPriority.push(i);
			}

			self.colWidth /= self.lastItems.length;

			//console.log(prevCols + '->' + self.lastItems.length);
			if (!o.useCalc || prevCols !== self.lastItems.length) {
				//set item widths carefully - if columns changed or px widths used
				for (i = self.items.length; i--;) {
					this._setItemWidth(self.items[i]);
				}
			}

			return self.lastItems.length;
		},

		//full update of layout
		_updateInterval: 0,
		_update: function(from, to) {
			//window.start = Date.now()
			var self = this,
				i = 0,
				start = from || 0,
				end = to || self.items.length,
				colsNeeded = self._initLayoutParams();

			//console.log('beforePlace:' + this.lastItems.length)
			for (i = start; i < end; i++) {
				self._placeItem(self.items[i]);
			}
			//console.log('afterPlace:' + this.lastItems.length)

			self._maximizeHeight();
			self._trigger('reflow');
			//console.log('time elapsed: ' + (Date.now() - window.start) + 'ms')
		},

		//set item width based on span/colWidth
		_setItemWidth: function(el) {
			var span = el.span > this.lastItems.length ? this.lastItems.length : el.span,
				cols = this.lastItems.length,
				colWeight = span / cols;
			if (this.options.useCalc) {
				el.w = (100 * colWeight);
				el.style.width = this.prefixedCalc + '(' + (100 * colWeight) + '% - ' + (el.mr + el.ml + (this.pl + this.pr) * colWeight) + 'px)';
			} else {
				el.w = ~~(this.colWidth * span - (el.ml + el.mr));
				el.style.width = el.w + 'px';
			}
		},

		_placeItem: function(e) {
			var self = this,
				o = self.options;

			var lastHeights = self.lastHeights,
				lastItems = self.lastItems,
				colPriority = self.colPriority,
				minCol = 0,
				minH = 0,
				h = 0,
				c = 0,
				t = 0,
				end = 0,
				start = 0,
				span = e.span > lastItems.length ? lastItems.length : e.span,
				newH = 0,
				spanCols = [], //numbers of spanned columns
				spanHeights = [], //heights of spanned columns
				style,
				floatCol = e.floatCol;

			//console.log('------ item:' + e.innerHTML)
			//console.log('span:'+span)			

			//Find pro→per column to place item
			//console.log(colPriority)
			if (floatCol) {
				floatCol = floatCol > 0 ? Math.min(floatCol, lastItems.length - span) : (lastItems.length + floatCol);
			}
			if (span === 1) {
				//Single-span element
				if (floatCol === null) {
					//no align
					minCol = colPriority.shift();
				} else {
					//predefined column to align
					minCol = floatCol;
					for (c = 0; c < colPriority.length; c++) {
						if (colPriority[c] == minCol) {
							colPriority.splice(c, 1);
							break;
						}
					}
				}
				spanCols.push(minCol);
				minH = lastHeights[minCol];
			} else if (span >= lastItems.length) { //Full-span element
				minCol = 0;
				minH = lastHeights[colPriority[colPriority.length - 1]];
				spanCols = self.baseOrder.slice();
				spanCols.length = lastHeights.length;
				colPriority.length = 0;
			} else { //Some-span element
				if (floatCol !== null) {
					minCol = floatCol;
					minH = Math.max.apply(Math, lastHeights.slice(minCol, minCol + span));
					//console.log(lastHeights.slice(minCol, span))
					//console.log('fCol:' + floatCol + ' minH: ' + minH)
				} else {
					//Make span heights alternatives
					spanHeights.length = 0;
					minH = Infinity;
					minCol = 0;
					for (c = 0; c <= lastItems.length - span; c++) {
						spanHeights[c] = Math.max.apply(Math, lastHeights.slice(c, c + span));
						if (spanHeights[c] < minH) {
							minCol = c;
							minH = spanHeights[c];
						}
					}
				}
				//Replace priorities
				for (c = 0; c < colPriority.length;) {
					if (colPriority[c] >= minCol && colPriority[c] < minCol + span) {
						spanCols.push(colPriority.splice(c, 1)[0]);
					} else c++;
				}
			}

			//console.log(spanCols)
			//console.log(lastHeights)
			//console.log('↑ spanCols to ↓')

			//TODO: correct to work ok with options
			e.top = ~~minH; //stupid save value for translate3d
			if (o.useTranslate3d) {
				var offset = (100 * minCol / span) + '% + ' + ~~((e.ml + e.mr) * minCol / span) + 'px';
				if (o.useCalc) {
					e.style[cssPrefix + 'transform'] = this.prefixedTranslate3d + '( ' + this.prefixedCalc + '(' + offset + '), ' + e.top + 'px, 0)';
				} else {
					//Safari won't set -webkit-calc in element.style
					e.style[cssPrefix + 'transform'] = this.prefixedTranslate3d + '(' + ~~(self.colWidth * minCol) + 'px, ' + e.top + 'px, 0)';
				}
			} else {
				e.style.top = e.top + 'px';
				e.style.left = self.colWidth * minCol + self.pl + 'px';
			}
			//console.log(e.style[cssPrefix + 'transform'])

			//if element was added first time and is out of flow - show it
			//e.style.opacity = 1;
			e.removeAttribute('hidden');

			newH = self._getBottom(e); //this is the most difficult operation (e.clientHeight)
			for (t = 0; t < spanCols.length; t++) {
				lastItems[spanCols[t]] = e;
				self.lastHeights[spanCols[t]] = newH;
			}

			//console.log(lastItems)
			//console.log('↑ self.lastHeights to ↓')
			//console.log(self.lastHeights)
			//console.log('minCol:'+minCol+' minH:'+minH+' newH:'+newH)
			//console.log(colPriority)
			//console.log('↑ colPriorities to ↓')

			//Update colPriority
			for (c = colPriority.length; c--;) {
				h = self.lastHeights[colPriority[c]];
				if (newH >= h) {
					Array.prototype.splice.apply(colPriority, [c + 1, 0].concat(spanCols));
					break;
				}
			}
			if (colPriority.length < lastHeights.length) {
				Array.prototype.unshift.apply(colPriority, spanCols);
				//self.colPriority = spanCols.concat(colPriority)
			}
		},

		_getBottom: function(e) {
			if (!e) return 0; //this.pt;
			//TODO: memrize height, look for height change to avoid reflow
			return e.top + e.clientHeight + e.bt + e.bb + e.mb + e.mt;
		},

		_maximizeHeight: function() {
			var top = this.options.useTranslate3d ? this.pt : 0;
			this.el.style.minHeight = this.lastHeights[this.colPriority[this.colPriority.length - 1]] + this.pb + top + 'px';
		}

	});


	$.fn.waterfall = function(arg, arg2) {
		if (typeof arg == 'string') { //Call API method
			return $(this).each(function(i, el) {
					$(el).data('waterfall')[arg](arg2);
				});
		} else {
			if (!this.length) {
				throw new Error("No element passed to waterfall")
				return false;
			};
			var $this = $(this),
				opts = $.extend({}, {"colMinWidth": ~~$this[0].getAttribute("data-col-min-width") ||~~$this[0].getAttribute("data-width")}, arg);
			if (opts.width && !opts.colMinWidth) {
				opts.colMinWidth = opts.width;
			}
			var wf = new Waterfall($this, opts);
			if (!$this.data('waterfall')) $this.data('waterfall', wf);
			return wf;
		}
	};

	//prefix/features detector

	function detectCSSPrefix(property) {
		if (!property) property = 'transform';

		var style = document.defaultView.getComputedStyle(document.body, '');
		if (style[property]) return '';
		if (style['-webkit-' + property]) return '-webkit-';
		if (style['-moz-' + property]) return '-moz-';
		if (style['-o-' + property]) return '-o-';
		if (style['-khtml-' + property]) return '-khtml-';

		return false;
	}

	//autostart
	$(function() {
		var defClass = window.waterfall && window.waterfall.defaultClass || Waterfall.defaultClass;

		$('.' + defClass)
			.each(function(i, e) {
				var $e = $(e),
					opts = window.waterfall || {};
				$e.waterfall(opts);
			});
	});

})(window.jQuery || window.Zepto);