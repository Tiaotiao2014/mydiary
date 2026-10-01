import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import EditorView from './views/EditorView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/edit/:id', name: 'editor', component: EditorView },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
