import { Engine, Scene, FreeCamera, HemisphericLight, Vector3, MeshBuilder, Mesh, Color3, StandardMaterial, KeyboardInfo, KeyboardEventTypes } from '@babylonjs/core';
import { GameRenderer, BallState, PaddleState } from './interfaces';
import { GameColors } from '../constants/colors';
import { TransformNode } from '@babylonjs/core';
import { GlowLayer } from '@babylonjs/core';
import { AdvancedDynamicTexture, Control, TextBlock } from '@babylonjs/gui';

const GAME_WIDTH = 16;
const GAME_HEIGHT = 9;

export class BabylonRenderer implements GameRenderer {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private ballMesh: Mesh | null = null;
  private paddleMeshes: Mesh[] = [];
  private gameRoot: TransformNode | null = null;
  private fieldRoot: TransformNode | null = null;
  private glowLayer: GlowLayer | null = null;
  private guiTexture: AdvancedDynamicTexture | null = null;
  private instructionPanels: TextBlock[] = [];
  private mainMessageBlock: TextBlock | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private container: HTMLElement) {}

  async setup() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'babylon-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.border = GameColors.canvasBorder;
    this.canvas.style.boxShadow = GameColors.canvasShadow;

    const wrapper = this.container.querySelector('.canvas-wrapper');
    if (wrapper) wrapper.appendChild(this.canvas);   
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.gameRoot = new TransformNode("gameRoot", this.scene);
    this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    this.createInstructions();
    this.camera = new FreeCamera('camera', new Vector3(0, 0, -10), this.scene);
    this.camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA;
    this.updateCameraOrtho();
    const light = new HemisphericLight('light', new Vector3(0, 0, -1), this.scene);
    light.intensity = 1.2;   

    this.glowLayer = new GlowLayer("glow", this.scene);
    this.glowLayer.intensity = 0.8;
    this.glowLayer.blurKernelSize = 32; // optional set to 64 to soften glow

    this.fieldRoot = new TransformNode("fieldRoot", this.scene);
    if (this.gameRoot) {
      this.fieldRoot.parent = this.gameRoot;
    }
    this.drawFieldLines();

    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
    
    this.scene.onKeyboardObservable.add((kbInfo) => this.handleCameraControls(kbInfo));
    this.setupMouseControls();

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomStep = 0.1;
      this.zoom += e.deltaY > 0 ? zoomStep : -zoomStep;
      this.updateCameraOrtho();
    });

    this.canvas.addEventListener('dblclick', () => {
      if (!this.gameRoot) return;
      this.gameRoot.rotation.x = 0;
      this.gameRoot.rotation.y = 0;
      this.gameRoot.rotation.z = 0;
    });

    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(wrapper!);
  }

  private zoom = 0.9;
  private updateCameraOrtho() {
    if (!this.camera || !this.canvas) return;

    const aspect = this.canvas.width / this.canvas.height;
    const minZoom = 0.5;
    const maxZoom = 2;
    this.zoom = Math.max(minZoom, Math.min(this.zoom, maxZoom));

    if (aspect >= GAME_WIDTH / GAME_HEIGHT) {
      const visibleHeight = GAME_HEIGHT / this.zoom;
      const visibleWidth = visibleHeight * aspect;
      this.camera.orthoTop = visibleHeight / 2;
      this.camera.orthoBottom = -visibleHeight / 2;
      this.camera.orthoLeft = -visibleWidth / 2;
      this.camera.orthoRight = visibleWidth / 2;
    } else {
      const visibleWidth = GAME_WIDTH / this.zoom;
      const visibleHeight = visibleWidth / aspect;
      this.camera.orthoTop = visibleHeight / 2;
      this.camera.orthoBottom = -visibleHeight / 2;
      this.camera.orthoLeft = -visibleWidth / 2;
      this.camera.orthoRight = visibleWidth / 2;
    }
  }


  public drawGameState(paddles: PaddleState, ball: BallState, gameStatus: string) {
    if (!this.scene || !this.canvas) return;
    // Draw paddles
    const paddleEntries = Object.entries(paddles);
    while (this.paddleMeshes.length < paddleEntries.length) {
      const mesh = MeshBuilder.CreateBox(`paddle${this.paddleMeshes.length}`, { size: 1 }, this.scene);
      const mat = new StandardMaterial(`paddleMat${this.paddleMeshes.length}`, this.scene);
      mesh.material = mat;
      mesh.parent = this.gameRoot;
      this.paddleMeshes.push(mesh);
    }

    paddleEntries.forEach(([_, paddle], index) => {
      const mesh = this.paddleMeshes[index];

      mesh.scaling.x = paddle.width * GAME_WIDTH;
      mesh.scaling.y = paddle.height * GAME_HEIGHT;
      mesh.position.x = (paddle.x - 0.5 + paddle.width / 2) * GAME_WIDTH;
      mesh.position.y = (0.5 - paddle.y - paddle.height / 2) * GAME_HEIGHT;
      (mesh.material as StandardMaterial).diffuseColor = Color3.FromHexString(GameColors.paddleColors[index % GameColors.paddleColors.length]);
      (mesh.material as StandardMaterial).emissiveColor = Color3.FromHexString(GameColors.glow);
    });

    // Draw ball
    if (!this.ballMesh) {
      this.ballMesh = MeshBuilder.CreateSphere('ball', { diameter: 1 }, this.scene);
      const mat = new StandardMaterial('ballMat', this.scene);
      mat.diffuseColor = Color3.FromHexString(GameColors.ball);
      mat.emissiveColor = Color3.FromHexString(GameColors.glow);
      this.glowLayer?.addIncludedOnlyMesh(this.ballMesh);  // glow
      this.ballMesh.material = mat;
      this.ballMesh.parent = this.gameRoot;
    }

    if (gameStatus !== 'queued') {
      const worldRatio = (GAME_WIDTH + GAME_HEIGHT) * 1.5;

      this.ballMesh.setEnabled(true);
      this.ballMesh.scaling.x = ball.radius * worldRatio;
      this.ballMesh.scaling.y = ball.radius * worldRatio;
      this.ballMesh.scaling.z = ball.radius * worldRatio;

      this.ballMesh.position.x = (ball.x - 0.5) * GAME_WIDTH;
      this.ballMesh.position.y = (0.5 - ball.y) * GAME_HEIGHT;
    } else {
      this.ballMesh.setEnabled(false);
    }
    this.updateInstructions(gameStatus);
  }

  showLoading(): void {
  }

  hideLoading(): void {
  }

  setBackground() {
    if (this.scene) {
      this.scene.clearColor = Color3.FromHexString(GameColors.background).toColor4();
    }
  }

  showGameControls(): void {
    (document.getElementById('matchControl') as HTMLButtonElement)?.classList.remove('hidden');
    (document.getElementById('forfeit') as HTMLButtonElement)?.classList.remove('hidden');
  }

  resize() {
    if (!this.engine || !this.canvas) return;

    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.updateCameraOrtho();
    this.engine.resize();
  }

  cleanup() {
    this.engine?.dispose();
    this.resizeObserver?.disconnect();
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.ballMesh = null;
    this.paddleMeshes = [];
    this.resizeObserver = null;
  }


  private handleCameraControls(kbInfo: KeyboardInfo) {
  if (!this.gameRoot) return;

  const step = Math.PI / 180 * 5; // 5 degrees in radians

  if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
      switch (kbInfo.event.code) {
        case 'Numpad4':
          this.gameRoot.rotation.z += step;
          break;
        case 'Numpad6':
          this.gameRoot.rotation.z -= step;
          break;
        case 'Numpad8':
          this.gameRoot.rotation.x -= step;
          break;
        case 'Numpad2':
          this.gameRoot.rotation.x += step;
          break;
        case 'Numpad7':
          this.gameRoot.rotation.y -= step;
          break;
        case 'Numpad9':
          this.gameRoot.rotation.y += step;
          break;
        case 'Numpad5':
          this.gameRoot.rotation.x = 0;
          this.gameRoot.rotation.y = 0;
          this.gameRoot.rotation.z = 0;
          break;
      }
    }
  }

  private isDragging = false;
  private lastPointerX = 0;
  private dragButton = 0; // 0 = left, 2 = right
  private lastPointerY = 0;

  private setupMouseControls() {
    if (!this.scene || !this.canvas || !this.gameRoot) return;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragButton = e.button;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.canvas?.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      this.isDragging = false;
      this.canvas?.releasePointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging || !this.gameRoot) return;

      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      const rotationSpeed = 0.003;

      if (this.dragButton === 0) {
        this.gameRoot.rotation.x += dy * rotationSpeed;
        this.gameRoot.rotation.y += dx * rotationSpeed;
      } else if (this.dragButton === 2) {
        this.gameRoot.rotation.z += dx * rotationSpeed;
      }

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private drawFieldLines() {
    if (!this.scene || !this.fieldRoot) return;

    const lineColor = Color3.FromHexString(GameColors.centerLine);
    const lineThickness = 0.09;
    const lineDepth = 0.01;
    const zOffset = 0.5;

    const createLineBox = (
      name: string,
      width: number,
      height: number,
      x: number,
      y: number
    ) => {
    const box = MeshBuilder.CreateBox(name, {
      width,
      height,
      depth: lineDepth,
    }, this.scene);
    box.position.set(x, y, zOffset);
    box.parent = this.fieldRoot;

    const mat = new StandardMaterial(`${name}Mat`, this.scene!);
    mat.diffuseColor = lineColor;
    mat.emissiveColor = Color3.FromHexString(GameColors.fieldLine);
    mat.alpha = 0.7;
    box.material = mat;
    this.glowLayer?.addIncludedOnlyMesh(box);
    box.isPickable = false;
    return box;
  };

    const halfW = GAME_WIDTH / 2;
    const halfH = GAME_HEIGHT / 2;
    const offset = lineThickness / 2;

    createLineBox("top", GAME_WIDTH, lineThickness, 0, halfH - offset);
    createLineBox("bottom", GAME_WIDTH, lineThickness, 0, -halfH + offset);
    createLineBox("left", lineThickness, GAME_HEIGHT, -halfW + offset, 0);
    createLineBox("right", lineThickness, GAME_HEIGHT, halfW - offset, 0);
    createLineBox("center", lineThickness, GAME_HEIGHT, 0, 0);
  }

  private createInstructions() {
    if (!this.guiTexture) return;

    this.instructionPanels.forEach(panel => this.guiTexture!.removeControl(panel));
    this.instructionPanels = [];
    this.mainMessageBlock = new TextBlock();
    this.mainMessageBlock.color = GameColors.text.primary;
    this.mainMessageBlock.fontFamily = GameColors.text.font;
    this.mainMessageBlock.fontSize = "24px";
    this.mainMessageBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.mainMessageBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.mainMessageBlock.top = "";
    this.mainMessageBlock.paddingBottom = "9%";
    this.mainMessageBlock.transformCenterX = 0.5;
    this.guiTexture.addControl(this.mainMessageBlock);

    const instructionsCount = 3;
    for (let i = 0; i < instructionsCount; i++) {
      const block = new TextBlock();
      block.color = GameColors.text.primary;
      block.fontFamily = GameColors.text.font;
      block.fontSize = "20px";
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      block.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      block.top = `${5 + i * 5}%`; // 15%, 20%, 25% vertically
      block.transformCenterX = 0.5;
      this.guiTexture.addControl(block);
      this.instructionPanels.push(block);
    }
  }

  private updateInstructions(gameStatus: string) {
    if (!this.mainMessageBlock || this.instructionPanels.length === 0) return;

    if (gameStatus === 'waiting' || gameStatus === 'queued') {
      const isWaiting = gameStatus === 'waiting';
      const mainMessage = isWaiting ? 'Press SPACE to resume' : 'Waiting for other players';

      this.mainMessageBlock.text = mainMessage;

      const instructions = [
        'Move paddle with W S - ⬆️ ⬇️ for local match',
        'Camera controls with mouse "click + move" or numpad - 5 resets camera to default'
      ];

      for (let i = 0; i < this.instructionPanels.length; i++) {
        this.instructionPanels[i].text = instructions[i] || '';
      }
    } else {
      this.mainMessageBlock.text = '';
      this.instructionPanels.forEach(panel => panel.text = '');
    }
  }
}
