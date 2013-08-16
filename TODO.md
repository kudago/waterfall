* Correct chrome rounding of item offsets

* Use translate-3d and calc, if possible. If not - use simple absolute positioning.

* BUG: data-col-width fails to read

* BUG: fix case where there’s only three items, but pasteable 4 columns (footer in kudago)
	* Min-col-num property, max-col-num

* Restrict max columns number

* Move out animations to the css

* Finish up deferreds (fix zepto/jquery bad behaviour, test for nested images)

* Make full equivalent to css-columns

* Test on jquery sequential image-loading along with non-image elements (as header inside content)

* On `add` - animate from bottom of the screen

* BUG: Fucks up layout if -webkit-animation top

* Update only visible part on add, do not recalculate

* Speed up appending of elements. Too slow for now.

* Deferred image loading of new elements.

* Scroll only visible part

* Specified number of columns, e.g. 2,4,6. No 3.

* Keep viewport scrolling on reflow

* Fixed-width floating aside column
* Correct reflow when inner element size changed
* Displacement as on gplus when new item added.
* Test float elements with prerender mode
* Keep position(order) tracking, e.g. if I want to fix some element on top of column