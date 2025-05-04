var d=Object.defineProperty;var u=(r,e,t)=>e in r?d(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var o=(r,e,t)=>u(r,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function t(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(n){if(n.ep)return;n.ep=!0;const i=t(n);fetch(n.href,i)}})();class h{constructor(){o(this,"routes");this.routes=new Map,window.addEventListener("popstate",()=>this.handleRoute())}addRoute(e,t){this.routes.set(e,t)}navigate(e){window.history.pushState({},"",e),this.handleRoute()}handleRoute(){const e=window.location.pathname,t=this.routes.get(e);t&&t()}}class c{constructor(e,t){o(this,"container");o(this,"router");this.container=e,this.router=t,this.render()}render(){this.container.innerHTML=`
            <div class="menu-container">
                <h1 class="menu-title">DUCKONG</h1>
                <div class="menu-buttons">
                    <button class="menu-button" id="one-duck">1 Duck</button>
                    <button class="menu-button" id="two-ducks">2 Ducks</button>
                    <button class="menu-button" id="settings">Settings</button>
                </div>
                <div class="auth-menu">
                    <button class="auth-button" id="login">Login</button>
                    <button class="auth-button" id="register">Register</button>
                </div>
            </div>
        `,this.addEventListeners()}addEventListeners(){const e=document.getElementById("one-duck"),t=document.getElementById("two-ducks"),s=document.getElementById("settings"),n=document.getElementById("login"),i=document.getElementById("register");e&&e.addEventListener("click",()=>{this.router.navigate("/game/one-duck")}),t&&t.addEventListener("click",()=>{this.router.navigate("/game/two-ducks")}),s&&s.addEventListener("click",()=>{this.router.navigate("/settings")}),n&&n.addEventListener("click",()=>{this.router.navigate("/login")}),i&&i.addEventListener("click",()=>{this.router.navigate("/register")})}}class l{constructor(e,t){o(this,"container");o(this,"score",0);o(this,"gameTime",60);o(this,"duck");o(this,"timer",0);o(this,"onGameEnd");var s;this.container=e,this.onGameEnd=t,this.render(),this.duck=this.createDuck(),(s=this.container.querySelector(".game-canvas"))==null||s.appendChild(this.duck),this.startGame()}render(){this.container.innerHTML=`
            <div class="game-container">
                <div class="game-header">
                    <h2>Duck Hunt</h2>
                    <div class="time-remaining">Time Remaining: <span id="timer">60</span>s</div>
                </div>
                <div class="game-canvas"></div>
                <div class="score-board">
                    <div>Score: <span id="current-score">0</span></div>
                    <div>High Score: <span id="high-score">${localStorage.getItem("duckGameHighScore")||0}</span></div>
                </div>
            </div>
        `;const e=document.createElement("style");e.textContent=`
            .game-container {
                width: 100%;
                height: 100vh;
                background-color: #1a1a1a;
                display: flex;
                flex-direction: column;
                align-items: center;
                color: white;
            }

            .game-header {
                width: 100%;
                padding: 1rem;
                background-color: #2a2a2a;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .game-canvas {
                width: 800px;
                height: 600px;
                background-color: #333;
                margin: 2rem;
                position: relative;
                border-radius: 8px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
            }

            .duck {
                width: 50px;
                height: 50px;
                background-color: #f4a460;
                border-radius: 50%;
                position: absolute;
                transform: translate(-50%, -50%);
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .duck::before {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                background-color: #deb887;
                border-radius: 50%;
                top: 10px;
                left: 35px;
            }

            .score-board {
                padding: 1rem;
                background-color: #2a2a2a;
                border-radius: 8px;
                margin-top: 1rem;
                display: flex;
                gap: 2rem;
            }
        `,document.head.appendChild(e)}createDuck(){const e=document.createElement("div");return e.className="duck",e.style.left="400px",e.style.top="300px",e.addEventListener("click",()=>this.handleDuckClick()),e}handleDuckClick(){this.score++,document.getElementById("current-score").textContent=this.score.toString(),this.moveDuck()}moveDuck(){const e=Math.random()*700+50,t=Math.random()*500+50;this.duck.style.left=`${e}px`,this.duck.style.top=`${t}px`}startGame(){setInterval(()=>this.moveDuck(),2e3),this.timer=window.setInterval(()=>{this.gameTime--,document.getElementById("timer").textContent=this.gameTime.toString(),this.gameTime<=0&&this.endGame()},1e3)}endGame(){clearInterval(this.timer);const e=parseInt(localStorage.getItem("duckGameHighScore")||"0");this.score>e&&localStorage.setItem("duckGameHighScore",this.score.toString()),this.onGameEnd()}}class m{constructor(e){o(this,"container");o(this,"router");this.container=e,this.router=new h,this.setupRoutes(),this.showInitialScreen()}setupRoutes(){this.router.addRoute("/",()=>{this.container.innerHTML="",new c(this.container,this.router)}),this.router.addRoute("/game/one-duck",()=>{this.container.innerHTML="",this.renderGameScreen()}),this.router.addRoute("/game/two-ducks",()=>{this.container.innerHTML="",this.renderGameScreen()}),this.router.addRoute("/settings",()=>{this.container.innerHTML="<h1>Settings Page</h1>"}),this.router.addRoute("/login",()=>{this.container.innerHTML="<h1>Login Page</h1>"}),this.router.addRoute("/register",()=>{this.container.innerHTML="<h1>Register Page</h1>"})}renderGameScreen(){new l(this.container,()=>{this.router.navigate("/")})}showInitialScreen(){const e=window.location.pathname;e==="/"?new c(this.container,this.router):this.router.navigate(e)}}document.addEventListener("DOMContentLoaded",()=>{const r=document.getElementById("root");if(!r){console.error("Root element not found");return}new m(r)});
