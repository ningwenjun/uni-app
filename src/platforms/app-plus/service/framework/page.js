import {
  initWebview,
  createWebview
} from './webview'

import {
  navigateFinish
} from './navigator'

import tabBar from '../framework/tab-bar'

import {
  createPage
} from '../../page-factory'

import {
  loadPage
} from './load-sub-package'

const pages = []

export function getCurrentPages (returnAll) {
  return returnAll ? pages.slice(0) : pages.filter(page => {
    return !page.$page.meta.isTabBar || page.$page.meta.visible
  })
}

const preloadWebviews = {}

export function preloadWebview ({
  url,
  path,
  query
}) {
  if (!preloadWebviews[url]) {
    const routeOptions = JSON.parse(JSON.stringify(__uniRoutes.find(route => route.path === path)))
    preloadWebviews[url] = createWebview(path, routeOptions, query, {
      __preload__: true,
      __query__: JSON.stringify(query)
    })
  }
  return preloadWebviews[url]
}

/**
 * 首页需要主动registerPage，二级页面路由跳转时registerPage
 */
export function registerPage ({
  url,
  path,
  query,
  openType,
  webview
}) {
  if (preloadWebviews[url]) {
    webview = preloadWebviews[url]
    delete preloadWebviews[url]
  }
  const routeOptions = JSON.parse(JSON.stringify(__uniRoutes.find(route => route.path === path)))

  if (
    openType === 'reLaunch' ||
    (
      !__uniConfig.realEntryPagePath &&
      pages.length === 0
    )
  ) {
    routeOptions.meta.isQuit = true
  } else if (!routeOptions.meta.isTabBar) {
    routeOptions.meta.isQuit = false
  }

  if (!webview) {
    webview = createWebview(path, routeOptions, query)
  } else {
    webview = plus.webview.getWebviewById(webview.id)
    webview.nvue = routeOptions.meta.isNVue
  }

  if (routeOptions.meta.isTabBar) {
    routeOptions.meta.visible = true
  }

  if (routeOptions.meta.isTabBar && webview.id !== '1') {
    tabBar.append(webview)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[uni-app] registerPage(${path},${webview.id})`)
  }

  initWebview(webview, routeOptions, path, query)

  const route = path.slice(1)

  webview.__uniapp_route = route

  const pageInstance = {
    route,
    options: Object.assign({}, query || {}),
    $getAppWebview () {
      // 重要，不能直接返回 webview 对象，因为 plus 可能会被二次替换，返回的 webview 对象内部的 plus 不正确
      // 导致 webview.getStyle 等逻辑出错(旧的 webview 内部 plus 被释放)
      return plus.webview.getWebviewById(webview.id)
    },
    $page: {
      id: parseInt(webview.id),
      meta: routeOptions.meta,
      path,
      route,
      openType
    },
    $remove () {
      const index = pages.findIndex(page => page === this)
      if (index !== -1) {
        if (!webview.nvue) {
          this.$vm.$destroy()
        }
        pages.splice(index, 1)
        if (process.env.NODE_ENV !== 'production') {
          console.log('[uni-app] removePage(' + path + ')[' + webview.id + ']')
        }
      }
    },
    // 兼容小程序框架
    selectComponent (selector) {
      return this.$vm.selectComponent(selector)
    },
    selectAllComponents (selector) {
      return this.$vm.selectAllComponents(selector)
    }
  }

  pages.push(pageInstance)

  // if (webview.__preload__) {
  //   // TODO 触发 onShow 以及绑定vm，page 关系
  // }

  // 首页是 nvue 时，在 registerPage 时，执行路由堆栈
  if (webview.id === '1' && webview.nvue) {
    if (
      __uniConfig.splashscreen &&
      __uniConfig.splashscreen.autoclose &&
      !__uniConfig.splashscreen.alwaysShowBeforeRender
    ) {
      plus.navigator.closeSplashscreen()
    }
    __uniConfig.onReady(function () {
      navigateFinish(webview)
    })
  }

  if (__PLATFORM__ === 'app-plus') {
    if (!webview.nvue) {
      const pageId = webview.id
      try {
        loadPage(route, () => {
          createPage(route, pageId, query, pageInstance).$mount()
        })
      } catch (e) {
        console.error(e)
      }
    }
  }

  return webview
}
