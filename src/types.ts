export type ScreenResolution = [width: number, height: number];

export type DrawableContext = {
  /** Video element of the users video */
  video: HTMLVideoElement;

  /** Video element of the users screen share */
  screen: HTMLVideoElement;
  context: CanvasRenderingContext2D;
  resolution: ScreenResolution;
};

export type Drawable = {
  // TODO: We need a `start` and `stop` method to start and stop the rendering of the drawable.
  // So we know when to start video or whatever
  // How will transitions work??
  draw: (drawableContext: DrawableContext) => void;
};

/**
 * An element in a layer. An element has a position and size within a layer.
 */
export type Element = {
  type: string;
  position: [x: number, y: number];
  size: [width: number, height: number];
};

/**
 * A layer in a scene. A layer is a collection of elements.
 */
export type Layer = {
  elements: Element[];
};

/**
 * One scene in a screenplay. A scene is a collection of layers.
 */
export type Scene = {
  layers: Layer[];
};

/**
 * Definition of a full screenplay. Tracks all the scenes, transitions between the scenes.
 */
export type Screenplay = {
  scenes: Scene[];
};

/** Renderer of a given element. */
export type ElementRenderer = Drawable & {
  new (element: Element): ElementRenderer;
  element: Element;
};

/** Renderer of a given layer. */
export type LayerRenderer = Drawable & {
  new (layer: Layer): LayerRenderer;
  layer: Layer;
};

/** Renderer of a given scene. */
export type SceneRenderer = Drawable & {
  new (scene: Scene): SceneRenderer;
  scene: Scene;
};

/** Renderer of a given screenplay. */
export type ScreenplayRenderer = Drawable & {
  new (screenplay: Screenplay): ScreenplayRenderer;
  screenplay: Screenplay;
};
