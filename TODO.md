* On add animate from bottom;

* Fucks up layout if -webkit-animation top

* Update only visible part on add, do not recalculate

* Turn in mutation observer, refill automatically each time DOM changed.

* Speed up appending of elements. Too slow for now.

* BUG: sometimes pastes improperly, at the bottom there is one column higher that others. Deferred image loading?

* Scroll only visible part (mode)

* Specified number of columns, e.g. 2,4,6. No 3.

* Floats mode (no columns at all)

* Equal columns height
* Fix up scrolling on reflow
* Fixed-width floating aside column
* Think of margins between columns
* Correct reflow when inner element size changed
* Displacement as on gplus when new item added.
* When images loaded, reflow
* Test simultaneous float or colnumber with prerender
* Make position-tracking, as if I wanted to fix some element on top of column.
