// note: Hand-rolled dev host standing in for the SDK debug UI, which v0.1.0 cannot
// serve. Served by the dev server's control port via
// `assetRoot`, so the manifest placeholder in index.html is injected the same way
// the real debug UI would receive it.
const manifest = window.__HF_DEBUG_MANIFEST__
const log = document.getElementById('log')

const EMITTED = ['tick', 'time', 'format-changed', 'timezone-changed', 'locale-changed', 'alarm-set', 'alarm-fired', 'alarm-cleared']

function line(kind, label, payload) {
  const div = document.createElement('div')
  div.className = kind
  const time = new Date().toLocaleTimeString()
  div.textContent = `${time} ${label}${payload === undefined ? '' : ` ${JSON.stringify(payload)}`}`
  log.append(div)
  log.scrollTop = log.scrollHeight
}

const app = manifest.apps[0]
if (!app) {
  line('life', 'no app in manifest — is the feature built?')
} else {
  // note: The contract here is the clock contract seen from the host's side —
  // emitted/accepted swapped by hand, since the SDK has no host-orientation helper
  // and `createShell` validates outgoing sends against `emitted`.
  const shell = HyperfrontendFeaturesHost.createShell({
    container: '#stage',
    url: app.url,
    name: app.name,
    contract: {
      emitted: ['get-time', 'set-format', 'set-timezone', 'set-locale', 'set-alarm', 'clear-alarm'].map((type) => ({ type })),
      accepted: EMITTED.map((type) => ({ type })),
    },
  })

  for (const event of ['open', 'close', 'error']) {
    shell.on(event, (payload) => line('life', `[lifecycle] ${event}`, payload))
  }
  for (const type of EMITTED) {
    shell.on(type, (payload) => line('in', `← ${type}`, payload))
  }

  const send = (type, payload) => {
    shell.send(type, payload)
    line('out', `→ ${type}`, payload)
  }

  for (const button of document.querySelectorAll('[data-send]')) {
    button.addEventListener('click', () => {
      const payload = button.dataset.payload ? JSON.parse(button.dataset.payload) : undefined
      send(button.dataset.send, payload)
    })
  }
  const value = (id) => document.getElementById(id).value.trim()
  document.getElementById('send-tz').addEventListener('click', () => send('set-timezone', { timezone: value('tz') }))
  document.getElementById('send-locale').addEventListener('click', () => send('set-locale', { locale: value('locale') }))
  document.getElementById('send-alarm').addEventListener('click', () => send('set-alarm', { at: value('alarm-at') }))
  document.getElementById('send-clear').addEventListener('click', () => send('clear-alarm', { id: value('alarm-id') }))

  line('life', `host bundle ready — embedding ${app.name} from ${app.url}`)
  shell.open()
}
