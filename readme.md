# jQuery.waterfall layout

jQuery.waterfall is straightforward <a href="http://pinterest.com">pinterest</a>-like layout with fluid width of columns. The primary goal was to create fast, tiny, reliable and free alternative for <a href="http://isotope.metafizzy.co/custom-layout-modes/masonry-column-shift.html">isotope masonry column shift</a> layout.

## Usage

Just make class `.waterfall` on container and that’s all.
```html
<div class="items-container waterfall">
	<div class="item">Item 1</div>
	<div class="item">Item 2</div>
	<div class="item">Item 3</div>
</div>

<script src="js/jquery.js"></script>
<script src="js/jquery.waterfall.js"></script>
```

Also you can launch waterfall manually:
```html
<script>
$(function () {
	$('.items-container').waterfall();
});
</script>
```
This will work out the same effect.

## Options

Options could be either parsed from container data-attributes:
```html
<div class="items-container waterfall" data-col-min-width="320" data-autoresize="true">
	<div class="item">Item 1</div>
	<div class="item">Item 2</div>
	<div class="item">Item 3</div>
</div>
```
or passed to init:
```javascript
var opts = {
	itemSelector: '.item',
	colMinWidth: 300,
	defaultContainerWidth: $('.container').width(),
	colClass: null,
	autoresize: true
}

$container.waterfall(opts);
```
#### `colMinWidth`
Minimal width of column, in px. If column width is below `colMinWidth`, number of columns will be recalculated.

#### `defaultContainerWidth`
Container may be hidden, so it’s preferably to pass default width. By default – `$(window).width()`.

#### `colClass`
Class to append to each column.

#### `Autoresize`
By default columns supposed to be recalculated manually on resize (bind `reflow` method on resizing window), but if you don’t want to care of this, pass this option as true

### Item properties
Also you can set an options straight on items to fix exact column to place the item into. For example, this may happens if you want to point exact column for element, whether it is menu or something else:
```html
<div class="items-container waterfall" data-col-min-width="320" data-autoresize="true">
	<div class="item" data-column="first">Item 1</div>
	<div class="item" data-column="last">Item 2</div>
	<div class="item" data-column="2">Item 3</div>
</div>
```


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
* when resize happens with columns recounting, the width of container shortly becomes zero, therefore document scrolls up. You should preserve scroll position in these cases.

