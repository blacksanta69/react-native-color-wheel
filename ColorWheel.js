// @flow

import React, { Component, useRef } from "react";
import {
  Animated,
  Image,
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
  Text
} from "react-native";
import colorsys from "colorsys";

export class ColorWheel extends Component {
  static defaultProps = {
    thumbSize: 50,
    initialColor: "#ffffff",
    onColorChange: () => {}
  };

  constructor(props) {
    super(props);
    this.state = {
      offset: { x: 0, y: 0 },
      currentColor: props.initialColor,
      pan: new Animated.ValueXY(),
      radius: 0,
      customColor: props.customColor || ["#FFF1DF", "#FFFFFF", "#C8F8FF"],
      mode: props.mode || "NORMAL"
    };

    this.imageRef = React.createRef();
  }
  componentDidUpdate(prevProps) {
    if (prevProps.initialColor !== this.props.initialColor) {
      console.log("componentDidUpdate onColorChange");
      this.setState({ currentColor: this.props.initialColor });
      this.measureOffset();
    }
  }
  componentDidMount = () => {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponderCapture: ({ nativeEvent }) => {
        this.measureOffset();
        console.log(
          "onStartShouldSetPanResponderCapture",
          nativeEvent.pageX,
          nativeEvent.pageY
        );
        if (this.outBounds(nativeEvent)) return;
        this.updateColor({ nativeEvent });
        this.setState({ panHandlerReady: true });

        this.state.pan.setValue({
          x: -this.state.left + nativeEvent.pageX - this.props.thumbSize / 2,
          y: -this.state.top + nativeEvent.pageY - this.props.thumbSize / 2
        });
        return true;
      },
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => true,
      onPanResponderMove: (event, gestureState) => {
        if (this.outBounds(gestureState)) return;

        this.resetPanHandler();
        return Animated.event(
          [
            null,
            {
              dx: this.state.pan.x,
              dy: this.state.pan.y
            }
          ],
          { listener: this.updateColor, useNativeDriver: false }
        )(event, gestureState);
      },
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: ({ nativeEvent }) => {
        this.setState({ panHandlerReady: true });
        this.state.pan.flattenOffset();
        const { radius } = this.calcPolar(nativeEvent);
        if (radius < 0.1) {
          this.forceUpdate("#ffffff");
        }

        if (this.props.onColorChangeComplete) {
          this.props.onColorChangeComplete(this.state.hsv);
        }
      }
    });
  };

  onLayout() {
    this.measureOffset();
  }

  measureOffset() {
    /*
     * const {x, y, width, height} = nativeEvent.layout
     * onlayout values are different than measureInWindow
     * x and y are the distances to its previous element
     * but in measureInWindow they are relative to the window
     */
    if (!this.self) {
      return;
    }
    this.self.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get("window");
      const absX = x % width;
      const radius = Math.min(width, height) / 2;
      const offset = {
        x: absX + width / 2,
        y: (y % window.height) + height / 2
      };

      this.setState({
        offset,
        radius,
        height,
        width,
        top: y % window.height,
        left: absX
      });
      this.forceUpdate(this.state.currentColor);
    });
  }

  calcPolar(gestureState) {
    const { pageX, pageY, moveX, moveY } = gestureState;
    const [x, y] = [pageX || moveX, pageY || moveY];
    const [dx, dy] = [x - this.state.offset.x, y - this.state.offset.y];

    return {
      deg: Math.atan2(dy, dx) * (-180 / Math.PI),
      // pitagoras r^2 = x^2 + y^2 normalized
      radius: Math.sqrt(dy * dy + dx * dx) / this.state.radius,
      position: { x: dx, y: dy }
    };
  }

  outBounds(gestureState) {
    const { radius } = this.calcPolar(gestureState);
    return radius > 1;
  }

  resetPanHandler() {
    if (!this.state.panHandlerReady) {
      return;
    }

    this.setState({ panHandlerReady: false });
    this.state.pan.setOffset({
      x: this.state.pan.x._value,
      y: this.state.pan.y._value
    });
    this.state.pan.setValue({ x: 0, y: 0 });
  }

  calcCartesian(deg, radius) {
    const r = radius * this.state.radius; // was normalized
    const rad = (Math.PI * deg) / 180;
    const x = r * Math.cos(rad);
    const y = r * Math.sin(rad);
    return {
      left: this.state.width / 2 + x,
      top: this.state.height / 2 - y
    };
  }
  interpolateColor = (c0, c1, f) => {
    c0 = c0.match(/.{1,2}/g).map(oct => parseInt(oct, 16) * (1 - f));
    c1 = c1.match(/.{1,2}/g).map(oct => parseInt(oct, 16) * f);
    let ci = [0, 1, 2].map(i => Math.min(Math.round(c0[i] + c1[i]), 255));
    return ci
      .reduce((a, v) => (a << 8) + v, 0)
      .toString(16)
      .padStart(6, "0");
  };
  updateColor = ({ nativeEvent }) => {
    const { deg, radius, position } = this.calcPolar(nativeEvent);

    const wheelDiameter = this.state.radius * 2 - this.props.thumbSize;
    const verticalPercentage = Math.min(
      1,
      Math.max(0, (position.y + wheelDiameter / 2) / wheelDiameter)
    );
    const hsv = { h: deg, s: 100 * radius, v: 100 };
    const currentColor = colorsys.hsv2Hex(hsv);

    if (this.props.mode === "CUSTOM" && this.props.customColor) {
      const customColorPercentage =
        verticalPercentage < 0.5
          ? verticalPercentage * 2
          : (verticalPercentage - 0.5) * 2;
      const customTargetColors =
        verticalPercentage < 0.5
          ? [
              this.props.customColor[0].replace("#", ""),
              this.props.customColor[1].replace("#", "")
            ]
          : [
              this.props.customColor[1].replace("#", ""),
              this.props.customColor[2].replace("#", "")
            ];
      const customColor =
        "#" +
        this.interpolateColor(
          customTargetColors[0],
          customTargetColors[1],
          customColorPercentage
        );
      this.setState({
        hsv: colorsys.hex2Hsv(customColor),
        currentColor: customColor
      });
    } else {
      this.setState({ hsv, currentColor });
    }
    this.props.onColorChange(hsv);
  };

  forceUpdate = color => {
    const { h, s, v } = colorsys.hex2Hsv(color);
    const { left, top } = this.calcCartesian(h, s / 100);
    this.setState({ currentColor: color });
    this.props.onColorChange({ h, s, v });
    this.state.pan.setValue({
      x: left - this.props.thumbSize / 2,
      y: top - this.props.thumbSize / 2
    });
  };

  animatedUpdate = color => {
    const { h, s, v } = colorsys.hex2Hsv(color);
    const { left, top } = this.calcCartesian(h, s / 100);
    this.setState({ currentColor: color });
    this.props.onColorChange({ h, s, v });
    Animated.spring(this.state.pan, {
      useNativeDriver: true,
      toValue: {
        x: left - this.props.thumbSize / 2,
        y: top - this.props.thumbSize / 2
      }
    }).start();
  };

  render() {
    const { radius } = this.state;
    const thumbStyle = [
      styles.circle,
      this.props.thumbStyle,
      {
        width: this.props.thumbSize,
        height: this.props.thumbSize,
        borderRadius: this.props.thumbSize / 2,
        backgroundColor: this.state.currentColor,
        opacity: this.state.offset.x === 0 ? 0 : 1
      }
    ];

    const panHandlers =
      (this._panResponder && this._panResponder.panHandlers) || {};
    return (
      <View
        ref={node => {
          this.self = node;
        }}
        {...panHandlers}
        onLayout={nativeEvent => this.onLayout(nativeEvent)}
        style={[styles.coverResponder, this.props.style]}
      >
        <Image
          ref={this.imageRef}
          style={[
            styles.img,
            {
              height: radius * 2,
              width: radius * 2
            }
          ]}
          source={
            this.props.mode === "CUSTOM"
              ? this.props.src
              : require("./color-wheel.png")
          }
        />
        <Animated.View style={[this.state.pan.getLayout(), thumbStyle]} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  coverResponder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  img: {
    alignSelf: "center"
  },
  circle: {
    position: "absolute",
    backgroundColor: "#EEEEEE",
    borderWidth: 3,
    borderColor: "#EEEEEE",
    elevation: 3,
    shadowColor: "rgb(46, 48, 58)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2
  }
});
