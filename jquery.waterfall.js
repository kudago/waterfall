/* Simple min-height-masonry layout plugin.
Like masonry column shift, but works. */
;(function($) {

	'use strict';

    // get css prefix for current browser
	var cssPrefix = detectCSSPrefix();



    /**
     * @desc Plugin prototype definition.
     * - just run function ._create
     * @param {jQuery} el - jquery dom object
     * @param {Object} opts - options used in plugin
     * @constructor
     */
	var Waterfall = function(el, opts) {

        // get dom refs
		this.$el = $(el);
		this.el = el[0];

        // run internal function to create plugin
		this._create(opts);
	};



    // set default class for plugin
	Waterfall.defaultClass = 'waterfall';



    /**
     * @desc extend definition of plugin prototype.
     * - add default options
     * - add all internal methods used by plugin.
     */
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



        /**
         * @desc make plugin works.
         * - hide container,
         * - check if plugin should use calc or css translate3d
         * - get dom childrens of container, save it in items attr and remove text node
         * - update styles of each children on list
         * - add window resize listener if needed
         * - add MutationObserver to remove/add new items on list if browser will handle this
         * @param {Object} opts - passed in plugin init
         * @private
         */
		_create: function(opts) {

            // local vard
			var self = this,
				o = self.options = $.extend({}, self.options, opts);

            // init basic vars
			this.items = [];
			self.lastHeights = [];
			self.lastItems = [];
			self.colPriority = []; //most left = most minimal column
			self.baseOrder = [];

            // get styles of container
			var cStyle = getComputedStyle(self.el);

            // hide element
			self.el.hidden = true;

            // prevent scrollbar width changing
			self.el.style.minHeight = cStyle.height;

            // set position relative if contianer have static position
			if (self.$el.css('position') === 'static') self.el.style.position = 'relative';

			//detect placing mode needed
            // check if useCalc option is setted by used
			if (o.useCalc === undefined) {

                /**
                 * @desc check if calc function can be used by browser
                 */
				this.prefixedCalc = (function() {

                    // get test dom element
					var dummy = document.createElement('div'),

                        // set list of properties to test
						props = ['calc', '-webkit-calc', '-moz-calc', '-o-calc'];

                    // check each property from list
					for (var i = 0; i < props.length; ++i) {

						var prop = props[i],
                            propStr =  prop + '(1px)';

                        // create css style needed to test
						dummy.style.cssText = cssPrefix + 'transform: translate3d(' + [propStr, propStr, propStr].join(',') +');';

						//console.log(dummy.style[cssPrefix + 'transform'])

                        // check if dom have needed styles apply
						if (dummy.style.length && dummy.style[cssPrefix + 'transform'].length > 14) {
							return prop;
						}
					}
				})();

                // change options useCalc and verify is calc function is used by browser
				o.useCalc = !!this.prefixedCalc;
			}

			//console.log(this.prefixedCalc);
            // check if useCalc option is setted by used
			if (o.useTranslate3d === undefined) {

                /**
                 * @desc check if browser can use css translate3d propery
                 */
				this.prefixedTranslate3d = (function() {

                    // get test dom element
					var dummy = document.createElement('div');

                    // set list of properties to test
					var props = ['translate3d', '-webkit-translate3d', '-moz-translate3d', '-o-translate3d'];

					for (var i = 0; i < props.length; ++i) {

						var prop = props[i];

                        // create css style needed to test
                        dummy.style.cssText = cssPrefix + 'transform:' + prop + '(1px, 0, 0);';

                        // check if dom have needed styles apply
						if (dummy.style.length){
                            return prop;
                        }
					}
				})();

                // check if browser have use css translate3d property
				o.useTranslate3d = !!this.prefixedTranslate3d;
			}
			//console.log(this.prefixedTranslate3d)

			//populate items
			var items;

            // get list of dom childerns
			{
				items = self.$el.children();
			}

			// remove text nodes
			for (var i = 0; i < self.el.childNodes.length;) {

                // check dom node type
				if (self.el.childNodes[i].nodeType !== 1 && self.el.childNodes[i].nodeType !== 8){
					self.el.removeChild(self.el.childNodes[i]);
				} else {
                    i++;
                }
			}

            // for each children add item to list and init styles
			items.each(function(i, e) {
				//self.items[i].data('id', i);

                // add item to internal items list
				self._addItem(e);

                // apply needed styles to item
				self._initItem(e);
			});

            // get dom refs to last children
			self.lastItem = self.items[self.items.length - 1];

            // show container
			self.el.removeAttribute("hidden");

            // set proper styles for each item in items array
			self._update();

            // verify is autoresise is on
			if (o.autoresize) {

                // trigger reflow function when window resize event occure
				$(window)
					.resize(self.reflow.bind(self));
			}

            // use MutationObserver functionality to add/remove items on list if browser can handle this
			this._observeMutations();
		},



        /**
         * @desc add item to internal list od items
         * @param {jQuery dom node} item
         * @private
         */
		_addItem: function(item){

            // check if item shouldnt be added to list
			if (item.getAttribute("data-exclude")) return;

            // add item to array
			this.items.push(item);
		},



        /**
         * @desc Make Node changing observer - the fastest way to add items
         * - on dom change sync internal array of items
         * @private
         */
		_observeMutations: function() {

            // check if browser support observers
			if (window.MutationObserver) {

				//FF, chrome
                // create new observer for children nodes
				this.observer = new MutationObserver(function(mutations) {

                    // get size of changes
                    var mNum = mutations.length;

                    // for each change take action
					for (var i = 0; i < mNum; i++) {

						//console.log(mutations[i])

                        // check if items were removed
						if (mutations[i].removedNodes.length) {

                            // remove items from internal array of items
							this._removedItems(Array.prototype.slice.apply(mutations[i].removedNodes));
						}

                        // check if items were added
						if (mutations[i].addedNodes.length) {

                            // add items to internal array of items
							var nodes = Array.prototype.slice.apply(mutations[i].addedNodes);

                            // add nodes to dom
							if (mutations[i].nextSibling) {
								this._insertedItems(nodes);
							} else {
								this._appendedItems(nodes);
							}
						}
					}
				}.bind(this));

                // set observe all childrens of container
				this.observer.observe(this.el, {
					attributes: false,
					childList: true,
					characterData: false
				});
			} else {

				//opera, ie
				this.$el

                    // handle action when new dom was inserted
                    .on('DOMNodeInserted', function(e) {
                        var evt = (e.originalEvent || e),
                            target = evt.target;

                        // check is new node is text
                        if (target.nodeType !== 1 && target.nodeType !== 8) return;

                        //if insertee is below container
                        if (target.parentNode !== this.el) return;

                        //console.log("--------" + target.className + " next:" + target.nextSibling + " prev:" + target.previousSibling)

                        // check if new item have special case
                        if (target.previousSibling && target.previousSibling.span && (!target.nextSibling || !target.nextSibling.span)) {
                            //append specific case, times faster than _insertedItems
                            this._appendedItems([target]);
                        } else {
                            this._insertedItems([target]);
                        }
                    }.bind(this))

                    // handle action when dom was removed
                    .on('DOMNodeRemoved', function(e) {

                        // get target
                        var el = (e.originalEvent || e).target;

                        // check is removed node was text
                        if (el.nodeType !== 1 && el.nodeType !== 8) return;

                        //if insertee is below container
                        if (el.parentNode !== this.el) return;

                        // remove item from list
                        this._removedItems([el]);
                    }.bind(this));
			}
		},



        /**
         * @desc API :: Ensures column number correct, reallocates items
         * @returns {Waterfall}
         */
		reflow: function() {
            // get local vars
			var self = this,
				o = self.options;

            // clear timeout from last timeout
			window.clearTimeout(self._updateInterval);

            // trigger _update function after timeout have done
			self._updateInterval = window.setTimeout(self._update.bind(self), o.updateDelay);

            // return Waterfall instance
			return self;
		},



        /**
         * @desc sync passed array of items with internal list of item and update position of each item
         * - called by mutation observer
         * @param {Array} items - list of container childrens, jquery dom objects
         * @private
         */
		_appendedItems: function(items) {

            // local vars
			var l = items.length,
				i = 0;

			//console.log("append: " + this.items.length)
            // touch each item on list
			for (; i < l; i++) {

                // get item
				var el = items[i];

                // check item type. Dont touch text node
				if (el.nodeType !== 1) continue;

                // append item to array of items
				this._addItem(el);

                // set styles for dom item
                //TODO: optimize
				this._initItem(el);

                // set width based on calculated valued
				this._setItemWidth(el);
			}

            // update position of each item in array
			for (i = 0; i < l; i++) {

                // dont touch text nodes
			    if (items[i].nodeType !== 1) continue;

                // udpdate position
				this._placeItem(items[i]);
			}

            // update refs to last item
			this.lastItem = this.items[this.items.length - 1];

            // set proper height of container
			this._maximizeHeight();
		},



        /**
         * @desc sync passed array of items with internal list of item and update position of each item
         *  - if new items inserted somewhere inside the list
         * @param {Array} items - list of container childrens, jquery dom objects
         * @private
         */
		_insertedItems: function(items) {
			//console.log("insert: " + this.items.length)
			//clear old items
			this.items.length = 0;

			//init new items
			var l = items.length;

			for (var i = 0; i < l; i++) {

                // get item
				var el = items[i];

                // check item type. Dont touch text node
				if (el.nodeType !== 1 && el.nodeType !== 8) continue;

                // init styles for dom item
                //TODO: optimize
				this._initItem(el);

                // set width based on calculated values
				this._setItemWidth(el);
			}

			// reinit all items
			var children = this.el.childNodes,
				itemsL = children.length;

			for (var i = 0; i < itemsL; i++){

                // check item type. Dont touch text node
				if (children[i].nodeType !== 1 && el.nodeType !== 8) continue;
				if (!children[i].span) continue;

                // add item to internal list of items
				this._addItem(children[i]);
			}

            // update refs to last item
			this.lastItem = this.items[this.items.length - 1];

            // trigger update styles of items
			this.reflow();
		},



        /**
         * @desc sync passed array of items with internal list of item and update position of each item
         *  - called by mutation observer
         * @param {Array} items - list of container childrens, jquery dom objects
         * @private
         */
		_removedItems: function(items) {

            // get local vars
			var childItems = this.el.childNodes,
				cl = childItems.length;

			//console.log("before removed: " + this.items.length)

			// reinit items
			for (var i = 0; i < items.length; i++){

                // add/remove items to list
				this.items.splice(this.items.indexOf(items[i]), 1);
			}

			//console.log("after remove:" + this.items.length)

            // refresh last item refs
			this.lastItem = this.items[this.items.length - 1];

            // trigger update styles of items
			this.reflow();
		},



        /**
         * @desc simple trigger routine
         * @param cbName
         * @param arg
         * @private
         */
		_trigger: function(cbName, arg) {
			try {

                // call event on container
				if (this.options[cbName]){
                    this.options[cbName].call(this.$el, arg);
                }

                // trigger event
				this.$el.trigger(cbName, [arg]);
			} catch (err) {

                // throw err if occur
				throw (err);
			}
		},



        /**
         * @desc init item properties once item appended
         * @param {jquery dom object} el - children of container
         * @private
         */
		_initItem: function(el) {

            // get variables
			var o = this.options,
				span = el.getAttribute('data-span') || 1,
				floatVal = el.getAttribute('data-float') || el.getAttribute('data-column');

			// set span
			span = (span === 'all' ? o.maxCols : Math.max(0, Math.min(~~(span), o.maxCols)));

            //quite bad, but no choice: dataset is sloow
			el.span = span;

			// save heavy style-attrs
			var style = getComputedStyle(el);

			el.mr = ~~(style.marginRight.slice(0, -2));
			el.ml = ~~(style.marginLeft.slice(0, -2));
			el.bt = ~~(style.borderTopWidth.slice(0, -2));
			el.bb = ~~(style.borderBottomWidth.slice(0, -2));
			el.mt = ~~(style.marginTop.slice(0, -2)); //ignored because of offsetTop instead of style.top
			el.mb = ~~(style.marginBottom.slice(0, -2));

			// set style
			el.style.position = 'absolute';
			//this._setItemWidth(el); //make it external action to not to init frominside create

			// parset float
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

            // check options
			if (o.animateShow) {

                // check if should be used css
				if (o.useTranslate3d) {
					//TODO: this below crashes chrome
					//el.style[cssPrefix+'translate'] = 'translate3d(0, ' + this.lastHeights[this.colPriority[0]] + 'px ,0)'
				} else {

                    // set style for each item. Default value
					el.style.top = this.lastHeights[this.colPriority[this.colPriority.length - 1]] + 'px';
					el.style.left = this.colWidth * this.colPriority[this.colPriority.length - 1] + 'px';
				}

                // show item
				el.removeAttribute('hidden');
			}
		},



        /**
         * @desc
         * @todo make docs
         * @returns {Number}
         * @private
         */
		_initLayoutParams: function() {

            // set local vars
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

			self.colWidth = self.el.offsetWidth - self.pl - self.pr;

			self.lastItems.length = ~~(self.colWidth / o.colMinWidth) || 1; //needed length
			// console.log(o.colMinWidth)

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



		// full update of layout
		_updateInterval: 0,



        /**
         * @desc trigger update position of each item, container and run reflow
         * @param {Integer} from - number between items should be updated
         * @param {Integer} to - number between items should be updated
         * @private
         */
		_update: function(from, to) {
			//window.start = Date.now()

            // set local vars
			var self = this,
				i = 0,
				start = from || 0,
				end = to || self.items.length,
				colsNeeded = self._initLayoutParams();

			//console.log('beforePlace:' + this.lastItems.length)

            // update styles of each item in array of childrens
			for (i = start; i < end; i++) {
				self._placeItem(self.items[i]);
			}

			//console.log('afterPlace:' + this.lastItems.length)

            // set proper height of container
			self._maximizeHeight();

            // trigger reflow of each item
			self._trigger('reflow');

			//console.log('time elapsed: ' + (Date.now() - window.start) + 'ms')
		},



        /**
         * @desc set item width based on span/colWidth
         * @param {jquery dom object} el - element which should be changed
         * @private
         */
		_setItemWidth: function(el) {

            // get amount of items
			var span = el.span > this.lastItems.length ? this.lastItems.length : el.span,

                // get amount of columns
				cols = this.lastItems.length,

                // one column width in percentage
				colWeight = span / cols;

            // check if use css calc function
			if (this.options.useCalc) {

                // get 100% of width
				el.w = (100 * colWeight);

                // set item width based of columns amount, margins and paddings
				el.style.width = this.prefixedCalc + '(' + (100 * colWeight) + '% - ' + (el.mr + el.ml + (this.pl + this.pr) * colWeight) + 'px)';
			} else {

                // set new width based on columns amount and margins
				el.w = ~~(this.colWidth * span - (el.ml + el.mr));

                // se new width
				el.style.width = el.w + 'px';
			}
		},



        /**
         * @desc set position of item in array of items.
         * @todo add docs
         * @param {jquery dom object} e - element which should be changed
         * @private
         */
		_placeItem: function(e) {

            // set local vars
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

            // check amount of columns
			if (span === 1) {

				// single-span element
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



        /**
         * @desc get bottom edge position of item(in pixels)
         * @param {jquery dom object} e - item
         * @returns {*}
         * @private
         */
		_getBottom: function(e) {

            // check if param is seteted
			if (!e) return 0; //this.pt;

			//TODO: memrize height, look for height change to avoid reflow
			return e.top + e.offsetHeight + e.bt + e.bb + e.mb + e.mt;
		},



        /**
         * @desc update style(minHeight) of container
         * @private
         */
		_maximizeHeight: function() {

            // get top position
			var top = this.options.useTranslate3d ? this.pt : 0;

            // set new height based on padding, height and position of last item in height
			this.el.style.minHeight = this.lastHeights[this.colPriority[this.colPriority.length - 1]] + this.pb + top + 'px';
		}
	});



    /**
     * @desc register plugin as jq library.
     * - Init plugin for each item in selector if arg is string
     * - Verify plugin dom refs and init plugin with arg2 as options. Moreover check min width of column.
     * @param arg - selector || jq dom item
     * @param arg2 - options
     * @returns {*}
     */
    $.fn.waterfall = function(arg, arg2) {

        //Call API method
        if (typeof arg == 'string') {

            // init plugin for each jQ object from selector
            return $(this).each(function(i, el) { $(el).data('waterfall')[arg](arg2); });
        } else {

            // check amount of dom refs
            if (!this.length) {
                throw new Error("No element passed to waterfall");
                return false;
            }

            // get basic values
            var $this = $(this),

            // set default options
                opts = $.extend({}, {

                    // try to get minimal column width from html attr
                    "colMinWidth": ~~$this[0].getAttribute("data-col-min-width") || ~~$this[0].getAttribute("data-width")
                }, arg);

            // set minimal column width of container if is not setted
            if (opts.width && !opts.colMinWidth) {
                opts.colMinWidth = opts.width;
            }

            // run plugin
            var wf = new Waterfall($this, opts);

            // set plugin instance reference
            if (!$this.data('waterfall')) $this.data('waterfall', wf);

            // return plugin instance
            return wf;
        }
    };



    /**
     * @desc Get name of css prefix based on document.defaultView styles
     * @param {String} property
     * @returns {*}
     */
    function detectCSSPrefix(property) {

        // check default values
        if (!property) property = 'transform';

        // get values of all css properties that document.body can have
        var style = document.defaultView.getComputedStyle(document.body, '');

        // check if style property is in object
        if (style[property]) return '';
        if (style['-webkit-' + property]) return '-webkit-';
        if (style['-moz-' + property]) return '-moz-';
        if (style['-o-' + property]) return '-o-';
        if (style['-khtml-' + property]) return '-khtml-';

        // false if non of options is proper attr
        return false;
    }



    // run plugin after document ready
    //
    $(function() {

        // get name of class for plugin
        var defClass = window.waterfall && window.waterfall.defaultClass || Waterfall.defaultClass;

        // find dom refs and init plugin
        $('.' + defClass)
            .each(function(i, e) {

                // get jQ dom ref and run plugin.
                var $e = $(e),
                    opts = window.waterfall || {};

                // init plugin
                $e.waterfall(opts);
            });
    });

})(window.jQuery || window.Zepto);
