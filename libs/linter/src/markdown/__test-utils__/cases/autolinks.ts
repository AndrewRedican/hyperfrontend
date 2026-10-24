/**
 * The `autolinks.md` document the Markdown parser specs read, and the tree the reference parser builds from it.
 *
 * @module markdown/__test-utils__/cases/autolinks
 */

export const AUTOLINKS = {
  name: 'autolinks.md',
  source: `a@b.c1 a@b.1c a@b1.c a@1.2 a@b.c-d a@b.cd. a@b-.c a@b.c_ x.y@z.w p@1.2.3 q@12.ab

[https://a.b/c](https://d.e) [x https://a.b/c](d) (https://a.b/c) https://a.b/c]d https://a.b/c)e

`,
  tree: `root 1:1:0-5:1:181
  paragraph 1:1:0-1:81:80
    text 1:1:0-1:8:7 value="a@b.c1 "
    link 1:8:7-1:14:13 url="mailto:a@b.1c"
      text 1:8:7-1:14:13 value="a@b.1c"
    text 1:14:13-1:15:14 value=" "
    link 1:15:14-1:21:20 url="mailto:a@b1.c"
      text 1:15:14-1:21:20 value="a@b1.c"
    text 1:21:20-1:28:27 value=" a@1.2 "
    link 1:28:27-1:35:34 url="mailto:a@b.c-d"
      text 1:28:27-1:35:34 value="a@b.c-d"
    text 1:35:34-1:36:35 value=" "
    link 1:36:35-1:42:41 url="mailto:a@b.cd"
      text 1:36:35-1:42:41 value="a@b.cd"
    text 1:42:41-1:44:43 value=". "
    link 1:44:43-1:50:49 url="mailto:a@b-.c"
      text 1:44:43-1:50:49 value="a@b-.c"
    text 1:50:49-1:58:57 value=" a@b.c_ "
    link 1:58:57-1:65:64 url="mailto:x.y@z.w"
      text 1:58:57-1:65:64 value="x.y@z.w"
    text 1:65:64-1:74:73 value=" p@1.2.3 "
    link 1:74:73-1:81:80 url="mailto:q@12.ab"
      text 1:74:73-1:81:80 value="q@12.ab"
  paragraph 3:1:82-3:98:179
    link 3:1:82-3:29:110 url="https://d.e"
      text 3:2:83-3:15:96 value="https://a.b/c"
    text 3:29:110-3:30:111 value=" "
    link 3:30:111-3:50:131 url="d"
      text 3:31:112-3:46:127 value="x https://a.b/c"
    text 3:50:131-3:52:133 value=" ("
    link 3:52:133-3:65:146 url="https://a.b/c"
      text 3:52:133-3:65:146 value="https://a.b/c"
    text 3:65:146-3:67:148 value=") "
    link 3:67:148-3:82:163 url="https://a.b/c]d"
      text 3:67:148-3:82:163 value="https://a.b/c]d"
    text 3:82:163-3:83:164 value=" "
    link 3:83:164-3:98:179 url="https://a.b/c)e"
      text 3:83:164-3:98:179 value="https://a.b/c)e"
`,
}
