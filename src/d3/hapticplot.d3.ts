import * as d3 from 'd3';
import * as THREE from 'three';
import { Entity, Component } from 'aframe';
import { sanitizeUrl } from '@braintree/sanitize-url';
import { Vector3 } from 'three';
import { BaseType } from 'd3';

const POINT_SIZE = 0.02;
const DEFAULT_COLOR = '#F0A202';
const HOVER_COLOR = 'red';
const SKY_COLOR = '#4d4d4d';
const ASSETS_FOLDER = 'assets/';
const GRAPH_SIZE = 1.4;
const GRAPH_OFFSET = new Vector3(0, 1, -0.35);

interface Sound extends Component {
  isPlaying: boolean;
  playSound(): void;
  stopSound(): void;
}

export class Hapticplot{
    private data: number[];
    private shape: string;
    private container: HTMLElement | null = null;
    private graphScale: d3.ScaleLinear<number, number>;
    private audioScale: d3.ScaleLinear<number, number>;

  constructor(shape: string) {
    this.shape = shape;
  }

  init(container: HTMLElement | null, data: number[]){
    this.data = data;
    this.container = container;
    // Creates a linear mapping from this.data to graph positions, haptic intensities, and audio selection
    this.graphScale = d3.scaleLinear()
      .domain([0, d3.max(this.data) as number])  // max of dataset
      .range([0, GRAPH_SIZE / 2]);
    this.audioScale = d3.scaleLinear()
      .domain([d3.min(this.data) as number, d3.max(this.data) as number])  // max of dataset
      .range([0, 27]);
    this.setupPoints(DEFAULT_COLOR, HOVER_COLOR, POINT_SIZE);
    this.createSky();
    this.createGridPlane();
  }

  /**
   * Selects all entities of type datapoint
   */
  private getShapes(){
    return d3.select(this.container).selectAll('datapoint');
  }

  /**
   * Generates data points in the scene based on initilization data
   *   - represented in scene as this.shape type entities
   * @param defaultColor Data points default color
   * @param hoverColor Data points color when hovered
   * @param size Size of each point
   */
  private setupPoints(defaultColor: string, hoverColor: string, size: number) {
    this.getShapes()
      // Adds points of type this.shape to the scene
      //  - "enter" identifies any DOM elements to be added when # array
      //    elements & # DOM elements don't match
      .data(this.data).enter().append(this.shape).classed('datapoint', true)
      // Adds given color property to all points
      .attr('color', defaultColor)
      // Sets points radius property
      .attr('radius', size)
      // Enables controller interaction with points using superhands' tags
      .attr('hoverable', '')
      // Updates points positions based on ingested data
      .each((d, i , g) => this.setPosition(d, i, g[i]))
      // Adds audio triggers to points based on ingested data
      .each((d, i , g) => this.setAudio(d, g[i]))
      // Adds listeners for state change events, which trigger a change in the
      // point's color property when a hover event occurs
      .on('hover-start',  (d, i, g) => this.onHoverStart(d, g[i], hoverColor))
      .on('hover-end',  () => this.onHoverEnd());
  }

  /**
   * Sets a world space position for each point, based on ingested data
   * @param data Ingested Data
   * @param index Current index in data array
   * @param point The point whos position is being set
   */
  private setPosition(datum: number, index: number, point: BaseType){
    const x = GRAPH_OFFSET.x + ((GRAPH_SIZE / 2) / this.data.length) * index;
    const y = GRAPH_OFFSET.y + this.graphScale(datum);
    const z = GRAPH_OFFSET.z;
    (point as Entity).object3D.position.set(x, y, z);
  }

  /**
   * Attaches audio triggers to each point, mapping associated data to mp3 marimba notes
   * @param datum Ingested Data
   * @param point The point who's position is being set
   */
  private setAudio(datum: number, point: BaseType){
    const sanitizedUrl = sanitizeUrl(`${ASSETS_FOLDER}marimbaNotes/${Math.round(this.audioScale(datum))}.mp3`);
    d3.select(point)
      .attr('sound', `src: url(${sanitizedUrl}); on: hover-start`);
  }

  /**
   * Triggers a haptic pulse and changes a points color and size when a it is hovered by the controller entity
   * @param point The point being hovered
   * @param hapticIntensity A points haptic intensity, based on is associated data
   * @param hoverColor The color the point takes on while hovered
   * @param size The radius of the point being hovered
   */
  private onHoverStart(datum: number, point: BaseType, hoverColor: string){
    d3.select(point)
      .attr('color', hoverColor);
    if (((point as Entity).components.sound as Sound).isPlaying){
      ((point as Entity).components.sound as Sound).stopSound();
    }
    d3.select(d3.event.detail?.hand)
    .on('abuttonup',  () => this.speakPosition(datum, point))
    .on('xbuttonup',  () => this.speakPosition(datum, point));
  }

  /**
   * Reads out the position of the given point in spoken audio, and resets its sound component to
   * the appropriate marimba note audio upon completion
   * @param datum The datum from which the given points position and audio is generated
   * @param point A data point entity
   */
  private speakPosition(datum: number, point: BaseType){
    const position = ((point as Entity).object3D.position as Vector3);
    const posString =
      `X${Math.round((position.x - GRAPH_OFFSET.x) * 100) / 100}` +
      `Y${Math.round((position.y - GRAPH_OFFSET.y) * 100) / 100}` +
      `Z${Math.round((position.z - GRAPH_OFFSET.z) * 100) / 100}`;
    this.speakStringRec(datum, posString, 0, point);
  }

  /**
   * This function sets the source of the given point's sound component
   * as the audio file specified by the value in the speech string at the given index.
   * It then sets up an event listener to call itself recursivly once the audio file completes,
   * playing the file at the following index. Once finished, it resets the marimba audio trigger.
   * @param datum The datum from which the given points position and audio is generated
   * @param speechString A string specifying the order in which the tts audio files should be played
   * @param index The index of the next file to be played within the speechString
   * @param point The point whos position is being spoken
   */
  private speakStringRec(datum: number, speechString: string, index: number, point: BaseType){
    const sanitizedUrlTts = sanitizeUrl(`${ASSETS_FOLDER}tts/tts${speechString[index]}.mp3`);
    d3.select(point)
      .attr('sound', `src: url(${sanitizedUrlTts});`);
    ((point as Entity).components.sound as Sound).playSound();
    index += 1;
    if (index < speechString.length){
      d3.select(point)
        .on('sound-ended',  (d, i, g) => this.speakStringRec(datum, speechString, index, g[i]));
    }
    else {
        d3.select(point)
          .on('sound-ended', () => this.setAudio(datum, point));
    }
  }

  /**
   * Removes X and A button listeners from the controller when a hover event occurs
   */
  private onHoverEnd(){
    d3.select(d3.event.detail?.hand)
      .on('abuttonup',  null)
      .on('xbuttonup',  null);
  }

  /**
   * Creates and adds a sky box to the scene
   */
  private createSky(){
    const aSky = document.createElement('a-sky');
    this.container!.appendChild(aSky);
    d3.select(this.container).selectAll('a-sky').attr('color', SKY_COLOR);
  }

  /**
   * Creates and adds grid 3D grid lines to the scene
   */
  private createGridPlane()
  {
    const xGrid = document.createElement('a-entity');
    xGrid.id = 'xGrid';
    this.container!.appendChild(xGrid);
    xGrid.object3D.add(new THREE.GridHelper(GRAPH_SIZE, 50, 0xffffff, 0xffffff));
    d3.select(this.container).select('#xGrid')
      .attr('position', `${GRAPH_OFFSET.x} ${GRAPH_OFFSET.y} ${GRAPH_OFFSET.z}`)
      .attr('rotation', '0 0 0');

    const yGrid = document.createElement('a-entity');
    yGrid.id = 'yGrid';
    this.container!.appendChild(yGrid);
    yGrid.object3D.add(new THREE.GridHelper(GRAPH_SIZE, 50, 0xffffff, 0xffffff));
    d3.select(this.container).select('#yGrid')
      .attr('position', `${GRAPH_OFFSET.x} ${GRAPH_OFFSET.y} ${GRAPH_OFFSET.z}`)
      .attr('rotation', '0 0 -90');

    const zGrid = document.createElement('a-entity');
    zGrid.id = 'zGrid';
    this.container!.appendChild(zGrid);
    zGrid.object3D.add(new THREE.GridHelper(GRAPH_SIZE, 50, 0xffffff, 0xffffff));
    d3.select(this.container).select('#zGrid')
      .attr('position', `${GRAPH_OFFSET.x} ${GRAPH_OFFSET.y} ${GRAPH_OFFSET.z}`)
      .attr('rotation', '-90 0 0');
  }
}
