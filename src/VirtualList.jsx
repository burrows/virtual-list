import React from 'react';
import PropTypes from 'prop-types';

class Item extends React.PureComponent {
  render() {
    const {itemIndex, itemView, item} = this.props;
    return (
      <div className="VirtualList-item">
        {React.cloneElement(itemView, {itemIndex, item})}
      </div>
    );
  }
}

function defaultGetItem(items, index) {
  return items[index];
}

function defaultGetItemKey(item, index) {
  return index;
}

// Public: `VirtualList` is a React component that virtualizes the rendering of its item rows in
// order to provide an efficient, high performing list view capable of handling a huge number of
// items.
//
// What sets `VirtualList` apart from other virtualized list implementations is that it makes no
// assumptions about the heights of your individual rows. Instead it makes an informed guess about
// how many rows it should render based on an average row height of the first 10 item rows. This
// defines a render "window". Then, as the user scrolls the list, it checks to see which items have
// scrolled out of view on and slides the window by that many items. This means that you can have
// arbitrarily sized rows and even rows whose sizes are purely determined by the browser. Thus, you
// should be able to swap this component in for any vertical list view that is rendered inside some
// fixed height container.
//
// Using `VirtualList` is straightforward. Simply give it an array of items and a component to use
// as the individual item views. The item view component will be passed `itemIndex` and `item`
// props representing the index of the item in the array and the item itself.
//
//   <VirtualList items={myItemArray}>
//     <MyItemView />
//   </VirtualList>
//
// The `VirtualList` component must be rendered inside of a fixed size container since it is
// positioned absolutely with top, right, bottom, and left offsets of 0. The item views are rendered
// inside of a nested content div. This content div has its top padding set to the average row
// height times the number of items before the rendered window. The bottom padding is set
// similarily. This is what creates the scrollable area and causes the browser to add an
// appropriately sized scrollbar. As the user scrolls through the list and the window is adjusted,
// the paddings are also adjusted accordingly.
class VirtualList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      winStart: 0,
      winSize: 10,
      viewportHeight: 1,
      avgRowHeight: 1,
      scrollTop: 0,
    };

    this.animationLoop = this.animationLoop.bind(this);
  }

  // Internal: After the component is mounted we do the following:
  //
  // 1. Start a requestAnimationFrame loop that checks for resize and scroll updates. When the
  //    container is resized we have to adjust the display window to ensure that we are rendering
  //    enough items to fill the viewport. When the container is scrolled we need to adjust the
  //    rendered window and item positions.
  // 2. Sample the just rendered row heights to get an average row height to use while handling
  //    scroll events.
  componentDidMount() {
    this.animationLoop();
    this.sampleRowHeights();
  }

  // Internal: After the component is updated we do the following:
  //
  // 1. Invoke the `onFirstVisibleItemChange` callback if the first visible item has changed since
  //    the last update.
  // 2. Re-sample row heights if we have fewer items than the display window size.
  // 3. Sync the components `scrollTop` state property with the node's `scrollTop` property. This is
  //    necessary to keep scrolling smooth as we add or remove rows whose heights differ from the
  //    average row height.
  componentDidUpdate() {
    const node = this.node;
    const {childNodes} = this.content;
    const {winSize, scrollTop} = this.state;

    this.notifyFirstVisibleItemIfNecessary();
    this.notifyLastVisibleItemIfNecessary();

    if (childNodes.length < winSize) {
      this.sampleRowHeights();
    }

    if (node.scrollTop !== scrollTop) {
      node.scrollTop = scrollTop;
    }
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._raf);
  }

  // Internal: This method gets called on each animation frame. It checks for the following:
  //
  // 1. Viewport height changes. When the viewport height has changed, we need to adjust the render
  //    window to ensure that we have enough items to fill it.
  // 2. Sroll changes. If the container has been scrolled since the last time we renedered we may
  //    need to adjust the render window.
  animationLoop() {
    const node = this.node;
    const { scrollTop, viewportHeight } = this.state;

    if (node.clientHeight !== viewportHeight) {
      this.handleResize();
    }

    if (node.scrollTop !== scrollTop) {
      this.scroll(node.scrollTop - scrollTop);
    }

    this._raf = requestAnimationFrame(this.animationLoop);
  }

  // Internal: When the container node has been resized we need to adjust the internal
  // `viewportHeight` and `winSize` state properties. This will ensure that we are always rendering
  // enough rows to fill the viewport.
  handleResize() {
    const node = this.node;
    const {avgRowHeight} = this.state;
    const viewportHeight = node.clientHeight;
    const winSize =
      Math.ceil(viewportHeight / avgRowHeight) + this.props.buffer;
    if (
      viewportHeight !== this.state.viewportHeight ||
      winSize !== this.state.winSize
    ) {
      this.setState({viewportHeight, winSize});
    }
  }

  sampleRowHeights() {
    const node = this.node;
    const childNodes = this.content.childNodes;

    if (childNodes.length) {
      let totalHeight = 0;
      for (let i = 0; i < childNodes.length; i++) {
        totalHeight += childNodes[i].offsetHeight;
      }
      const avgRowHeight = totalHeight / childNodes.length;
      const winSize =
        Math.ceil(node.clientHeight / avgRowHeight) + this.props.buffer;
      if (
        avgRowHeight !== this.state.avgRowHeight ||
        winSize !== this.state.winSize
      ) {
        this.setState({avgRowHeight, winSize});
      }
    }
  }

  notifyFirstVisibleItemIfNecessary() {
    if (!this.props.onFirstVisibleItemChange) {
      return;
    }

    const idx = this.findFirstVisibleItemIndex();

    if (this._firstIndex !== idx) {
      this.props.onFirstVisibleItemChange(this.props.items[idx], idx);
      this._firstIndex = idx;
    }
  }

  notifyLastVisibleItemIfNecessary() {
    if (!this.props.onLastVisibleItemChange) {
      return;
    }

    const idx = this.findLastVisibleItemIndex();

    if (this._lastIndex !== idx) {
      this.props.onLastVisibleItemChange(this.props.items[idx], idx);
      this._lastIndex = idx;
    }
  }

  findFirstVisibleItemIndex() {
    const childNodes = this.content.childNodes;
    const {items} = this.props;
    const {winStart, scrollTop} = this.state;

    for (let i = 0; i < childNodes.length; i++) {
      if (childNodes[i].offsetTop + childNodes[i].offsetHeight >= scrollTop) {
        return winStart + i;
      }
    }

    return undefined;
  }

  findLastVisibleItemIndex() {
    const childNodes = this.content.childNodes;
    const {items} = this.props;
    const {winStart, scrollTop, viewportHeight} = this.state;

    for (let i = childNodes.length - 1; i >= 0; i--) {
      if (childNodes[i].offsetTop < scrollTop + viewportHeight) {
        return winStart + i;
      }
    }

    return undefined;
  }

  handleDownwardScroll(delta, callback) {
    const childNodes = this.content.childNodes;
    const {items} = this.props;
    const {winSize, avgRowHeight} = this.state;
    const maxWinStart = Math.max(0, items.length - winSize);
    let {winStart, scrollTop} = this.state;

    scrollTop += delta;

    const startScrollTop = scrollTop;

    for (let i = 0; i < childNodes.length; i++) {
      if (
        winStart < maxWinStart &&
        childNodes[i].offsetTop + childNodes[i].offsetHeight < startScrollTop
      ) {
        winStart++;
        scrollTop += avgRowHeight - childNodes[i].offsetHeight;
      } else {
        break;
      }
    }

    scrollTop = Math.round(scrollTop);

    this.setState({winStart, scrollTop}, callback);
  }

  handleUpwardScroll(delta, callback) {
    const node = this.node;
    const childNodes = this.content.childNodes;
    let {winStart, scrollTop, avgRowHeight} = this.state;
    let n = 0;

    scrollTop += delta;

    for (let i = childNodes.length - 1; i >= 0; i--) {
      if (
        winStart > 0 &&
        childNodes[i].offsetTop - scrollTop > node.offsetHeight
      ) {
        winStart--;
        n++;
      } else {
        break;
      }
    }

    this.setState({winStart, scrollTop}, () => {
      const {childNodes} = this.content;

      const {avgRowHeight} = this.state;
      let {scrollTop} = this.state;

      for (let i = 0; i < n; i++) {
        scrollTop -= avgRowHeight - childNodes[i].offsetHeight;
      }

      scrollTop = Math.round(scrollTop);

      this.setState({scrollTop}, callback);
    });
  }

  handleLongScroll(delta, callback) {
    const {items} = this.props;
    const {winSize, avgRowHeight} = this.state;
    let {scrollTop} = this.state;
    const maxWinStart = Math.max(0, items.length - winSize);
    scrollTop += delta;
    this.setState(
      {
        winStart: Math.min(maxWinStart, Math.floor(scrollTop / avgRowHeight)),
        scrollTop,
      },
      callback,
    );
  }

  scroll(delta, callback) {
    const {viewportHeight} = this.state;

    if (Math.abs(delta) > viewportHeight) {
      this.handleLongScroll(delta, callback);
    } else if (delta > 0) {
      this.handleDownwardScroll(delta, callback);
    } else if (delta < 0) {
      this.handleUpwardScroll(delta, callback);
    }

    return this;
  }

  _scrollToIndex(index, callback) {
    const {winStart, winSize, avgRowHeight} = this.state;

    if (index >= winStart && index < winStart + winSize) {
      this.content.childNodes[index - winStart].scrollIntoView();
      if (callback) callback();
      return;
    }

    const {items} = this.props;
    const maxWinStart = Math.max(0, items.length - winSize);
    let newWinStart = Math.min(maxWinStart, index);
    let scrollTop = newWinStart * avgRowHeight;

    this.setState({winStart: newWinStart, scrollTop}, () => {
      this.content.childNodes[index - newWinStart].scrollIntoView();
      if (callback) callback();
    });
  }

  scrollToIndex(index, callback) {
    if (this.state.avgRowHeight === 1) {
      // The average row height is still the initial value, which means that we
      // haven't sampled the row heights yet, which we need in order to properly
      // scroll to the right position. So we need to delay the scroll logic
      // until after the list has had a chance to sample the row heights.
      this.setState({}, () => {
        this._scrollToIndex(index, callback);
      });
    } else {
      this._scrollToIndex(index, callback);
    }
  }

  scrollToItem(item, callback) {
    const index = this.props.items.indexOf(item);

    if (index >= 0) {
      this.scrollToIndex(index, callback);
    }

    return this;
  }

  scrollToTop(callback) {
    return this.scrollToIndex(0, callback);
  }

  // Public: Invoke this method whenever the `items` array has been mutated to cause the list to
  // sync up the display window and re-render.
  //
  // callback - An optional function to call once rendering has occurred.
  //
  // Returns the receiver.
  itemsMutated(callback) {
    const {items} = this.props;
    const {winStart, winSize} = this.state;
    const maxWinStart = Math.max(0, items.length - winSize);

    if (winStart > maxWinStart) {
      this.setState({winStart: maxWinStart}, callback);
    } else {
      this.forceUpdate(callback);
    }

    return this;
  }

  render() {
    const {items, getItem, getItemKey, scrollbarOffset} = this.props;
    const {winStart, winSize, avgRowHeight} = this.state;
    const winEnd = Math.min(items.length - 1, winStart + winSize - 1);
    const paddingTop = winStart * avgRowHeight;
    const paddingBottom = Math.max(
      (items.length - winStart - winSize) * avgRowHeight,
      0,
    );
    const style = Object.assign(
      {
        position: 'absolute',
        top: 0,
        right: scrollbarOffset,
        bottom: 0,
        left: 0,
        overflowY: 'auto',
        overflowX: scrollbarOffset ? 'hidden' : undefined,
      },
      this.props.style,
    );
    const contentStyle = {
      paddingTop,
      paddingBottom,
      marginRight: -scrollbarOffset,
    };
    const itemView = React.Children.only(this.props.children);
    const itemNodes = [];
    let item;

    for (let i = winStart; i <= winEnd; i++) {
      item = getItem(items, i);
      itemNodes.push(
        <Item
          key={getItemKey(item, i)}
          itemIndex={i}
          itemView={itemView}
          item={item}
        />,
      );
    }

    return (
      <div
        ref={node => {
          this.node = node;
        }}
        className="VirtualList"
        tabIndex="-1"
        style={style}
        onScroll={this.props.onScroll}>
        <div
          ref={content => {
            this.content = content;
          }}
          className="VirtualList-content"
          style={contentStyle}>
          {itemNodes}
        </div>
      </div>
    );
  }
}

VirtualList.propTypes = {
  // An array of model items to render into the list. This is the only required prop.
  items: PropTypes.array.isRequired,

  // Provide a function to access an item from the `items` array. Gets passed the `items` prop
  // and an index. The default implementation simply uses the `[]` operator. This exists to work
  // with an array object that is capable of paging itself such as the one provided by the
  // Transis library.
  getItem: PropTypes.func,

  // Provide a function to generate a react key for each item. Gets passed the item and its index.
  // The default simply returns the index.
  getItemKey: PropTypes.func,

  // Provide a callback function to be invoked whenever the first visible item changes due to a
  // scroll event.
  onFirstVisibleItemChange: PropTypes.func,

  // Provide a callback function that is invoked whenever the container is scrolled.
  onScroll: PropTypes.func,

  // Specify the number of buffer items to use in the display window. The virtual list will make
  // its best attempt to determine the minimum number of items necessary to fill the viewport and
  // then add this amount to that. The default value is 4.
  buffer: PropTypes.number,

  // Offset the scrollbar by the number of pixels specified. The default is 0.
  scrollbarOffset: PropTypes.number,

  // Style object applied to the container.
  style: PropTypes.object,
};

VirtualList.defaultProps = {
  getItem: defaultGetItem,
  getItemKey: defaultGetItemKey,
  buffer: 4,
  scrollbarOffset: 0,
};

module.exports = VirtualList;
