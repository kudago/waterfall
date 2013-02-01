# jQuery.waterfall layout

jQuery.waterfall is straightforward <a href="http://pinterest.com">pinterest</a>-like layout with fluid width of columns. The primary goal was to create fast, lightweight, bugproof and free alternative for <a href="http://isotope.metafizzy.co/custom-layout-modes/masonry-column-shift.html">isotope masonry column shift</a> layout.

## Usage

```javascript
<script src="js/jquery.js"></script>
<script src="js/jquery.masonry.js"></script>

<script>
//To make 
$(function () {
	$('.items-container').waterfall()
});
</script>

<div class="items-container">
	<div class="item">Item 1</div>
	<div class="item">Item 2</div>
	<div class="item">Item 3</div>
</div>
```

## Options
```
var opts = {
	itemSelector: '.item', //by default – children of container
	colMinWidth: 200, //px, by default – 200
	defaultContainerWidth: //Container may be hidden, so it’s necessary to set default width. By default – $(window).width(),
	colClass: null //Class to append to columns
}

$container.masonry(opts)
```


## Methods

To get waterfall instance:
```javascript
var waterfall = $('.items-container').data('waterfall');
```

`waterfall.reflow()` recounts needed number of columns, redistributes items. Speed is optimized, so it takes minimal possible calcs.
There’s a sense to use this if resize happened.


`waterfall.add(item)` appends new item or items to layout, use this instead of `container.append(item)`.
Waterfall will take care of optimal placing and appending

```javascript
waterfall.add($('<div class="item">Some item.</div>'));
waterfall.add($('<div class="item">Item 1.</div><div class="item">Item 2.</div>'));
```

## Principle

Plugin creates fluid columns according to `colMinWidth` param and carefully fills them with items.


## TODO
* demo

