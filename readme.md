# jQuery.waterfall layout

*UPD.* Use better [jquery.waterfall2](https://github.com/dfcreative/jquery.waterfall2) instead — it flows content based just only on float:left and float:right.

jQuery.waterfall is straightforward <a href="http://pinterest.com">pinterest</a>-like layout with fluid width of columns. The primary goal was to create fast, tiny, reliable and free alternative for <a href="http://isotope.metafizzy.co/custom-layout-modes/masonry-column-shift.html">isotope masonry column shift</a> layout.

## Usage

Just include waterfall and apply it on some container with items.
```html
<div class="items-container">
	<div class="item">Item 1</div>
	<div class="item">Item 2</div>
	<div class="item">Item 3</div>
</div>

<script src="js/jquery.js"></script>
<script src="js/jquery.waterfall.js"></script>
<script>
$(function () {
	$('.items-container').waterfall();
});
</script>
```

## Options

Options are passed when init takes place.
```javascript
var opts = {
	itemSelector: '.item',
	colMinWidth: 300,
	defaultContainerWidth: $('.container').width(),
	colClass: null
}

$container.waterfall(opts);
```

#### `itemSelector`
Optional item selector to form items. By default items are all children of container.

#### `colMinWidth`
Minimal width of column, in px. If column width is below `colMinWidth`, number of columns will be recalculated.

#### `defaultContainerWidth`
Container may be hidden, so it’s preferably to pass default width. By default – `$(window).width()`.

#### `colClass`
Class to append to each column.


## Methods

Waterfall instance is stored in `waterfall` data-attribute of jQuery.
```javascript
$('.items-container').waterfall();
var waterfall = $('.items-container').data('waterfall');
```

#### `waterfall.reflow()` 
Recounts needed number of columns, redistributes items. Optimized for speed, so it takes minimal possible calcs.
There’s a sense to call `waterfall.reflow()` if resize happened.

#### `waterfall.add(item)` 
Appends new item or bunch of items to layout. Using this is more preferrable than jQuery dom-inserting methods like `container.append(item)` etc.
Waterfall will take care of optimal placing and appending.

```javascript
waterfall.add($('<div class="item">Some item.</div>')); //one item
waterfall.add($('<div class="item">Item 1.</div><div class="item">Item 2.</div>')); //few items
```

## Principle of layout

Waterfall creates fluid columns according to `colMinWidth` param and fills them with items.

## TODO
* demo

