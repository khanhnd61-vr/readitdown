import { mount } from "svelte";
import "github-markdown-css/github-markdown-dark.css";
import "./app.css";
import App from "./App.svelte";
import { loadSaved } from "./lib/store.svelte";

loadSaved();

export default mount(App, { target: document.getElementById("app")! });
