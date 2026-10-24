/**
 * The `tables.md` document the Markdown parser specs read, and the tree the reference parser builds from it.
 *
 * @module markdown/__test-utils__/cases/tables
 */

export const TABLES = {
  name: 'tables.md',
  source: `| h |\t
| - |
| a |\t
| | x |
#notheading
<notatag
[^ x
    | deep |

| h2 | h3 |
| -- | -- |
`,
  tree: `root 1:1:0-12:1:92
  table 1:1:0-7:5:53 align=[null]
    tableRow 1:1:0-1:7:6
      tableCell 1:1:0-1:7:6
        text 1:3:2-1:4:3 value="h"
    tableRow 3:1:13-3:7:19
      tableCell 3:1:13-3:7:19
        text 3:3:15-3:4:16 value="a"
    tableRow 4:1:20-4:8:27
      tableCell 4:1:20-4:3:22
      tableCell 4:3:22-4:8:27
        text 4:5:24-4:6:25 value="x"
    tableRow 5:1:28-5:12:39
      tableCell 5:1:28-5:12:39
        text 5:1:28-5:12:39 value="#notheading"
    tableRow 6:1:40-6:9:48
      tableCell 6:1:40-6:9:48
        text 6:1:40-6:9:48 value="<notatag"
    tableRow 7:1:49-7:5:53
      tableCell 7:1:49-7:5:53
        text 7:1:49-7:5:53 value="[^ x"
  code 8:1:54-8:13:66 value="| deep |"
  table 10:1:68-11:12:91 align=[null,null]
    tableRow 10:1:68-10:12:79
      tableCell 10:1:68-10:6:73
        text 10:3:70-10:5:72 value="h2"
      tableCell 10:6:73-10:12:79
        text 10:8:75-10:10:77 value="h3"
`,
}
