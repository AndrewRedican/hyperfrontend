# Community signals: r/typescript koi pond thread

Research thread output for the microfrontend decision-framework project.
Compiled 2026-08-28.

## Sourcing and evidence status

- Target thread: https://www.reddit.com/r/typescript/comments/1vyebih/demo_hyperfrontend_its_called_8_frontend/
- reddit.com, old.reddit.com, api.reddit.com, and pullpush.io all returned 403 (network-security block) from this environment on 2026-08-28.
- Full post and complete comment set recovered from the Arctic Shift archive API (https://arctic-shift.photon-reddit.com/api/posts/ids?ids=1vyebih and .../api/comments/search?link_id=1vyebih), accessed 2026-08-28. Comment count in the archive (8) matches the post's recorded `num_comments` (8), so the thread is captured in full, including nested replies.
- All comment content below is verbatim from the archive; scores are snapshot values at archive time (~2026-08-27). Claim-type labels are per-item. Nothing here is fabricated or paraphrased beyond what is marked.

## What the thread is

- Title: "[DEMO] Hyperfrontend it's called; 8 frontend frameworks mingling together inside a koi pond"
- Subreddit: r/typescript. Author: u/ajrm7 (the HyperFrontend author; is_submitter on all reply comments).
- Posted: 2026-08-25 22:12:59 UTC. Removed by a subreddit moderator by ~2026-08-27 10:13 UTC (archive metadata: `removal_type: moderator`, `was_deleted_later: true`). The thread therefore had roughly a 36-hour public life.
- Reach at archive time: score 10, upvote ratio 1.0, 8 comments (4 of them the OP replying). Three distinct non-OP commenters: u/morefloordoor, u/shrimpcest, u/Sunstorm84.
- Demo link shared: https://www.hyperfrontend.dev/demos#koi-pond (8 framework apps composited into one pond scene via HyperFrontend).
- OP's own framing in the post body (relevant because commenters responded to it): "This is to all nay sayers of the good ol' reliable iframe. I say you were doing it wrong." and "this type of approach does not leverage code-deduplication, and prone to memory overhead in the browser. There's always a trade-off ain't it. This approach starts from isolation to earn cohesion back. It is specifically NOT module federation (aka code federation) and more like application federation."

## Alternatives and strategies mentioned by commenters

All items in this section are community-convention evidence (what practitioners in the wild reached for), unless labeled otherwise.

| Alternative | Who raised it | Claim made about it |
|---|---|---|
| Module Federation | u/morefloordoor (first comment, score 4, 23 min after posting) | The default baseline the demo must justify itself against: "Specifically… why not module federation? This takes on memory and speed tradeoffs for what benefit?" |
| Coordinated build scripts (monorepo-style coordination generally) | u/morefloordoor (score 3) | Framework heterogeneity alone is not a blocker: "So long as you coordinate your build scripts there's absolutely no issue, and that's standard practice." Only the "not owned by you" row of OP's org table was conceded as a real problem. |
| single-spa | u/shrimpcest (score 3, self-identified: "I work in a very mfe heavy space") | Incumbent-parity challenge: "Single Spa already supports this. Does this do anything that it doesn't?" (claim about single-spa: that multi-framework composition is already solved there; community-convention, not verified here) |
| Astro | u/Sunstorm84 (score 2) | Raised as prior art for multi-framework stitching: "Have you seen Astro?" (three words; the implied claim, that Astro already hosts multiple frameworks on one page, is inference from context; OP's reply interpreted it the same way) |
| iframes (the strategy under demo) | OP framing, engaged by commenters | Community engagement treated iframe composition as the costly option needing justification (memory, speed), never as the obvious default. |

OP's replies also introduced comparison vocabulary that no commenter pushed back on: "application federation" vs "code federation", and isolation that is "browser enforced" vs isolation that "rel[ies] on code conventions". Labels: OP-coined terminology, not community convention; the browser-enforced-isolation property of iframes itself is a browser-guarantee.

## Objections and concerns raised

1. Cost-benefit up front. A commenter argued, as the very first response: "why not module federation? This takes on memory and speed tradeoffs for what benefit?" (u/morefloordoor). Performance cost of per-app duplication is assumed, not debated; the demand is for the offsetting benefit.
2. The org-diversity table is not a real constraint. After OP posted a table of a hypothetical org (React 19 main product, Angular 17 billing, Vue 3 reporting, AngularJS admin, jQuery legacy, unknown partner widget, customer extension not owned by you) and claimed "Module Federation wouldn't be feasible", the same commenter argued: "It's sort of a misleading list, no? The only important item is 'not owned by you'. So long as you coordinate your build scripts there's absolutely no issue, and that's standard practice." The objection: framework mix is solvable with coordination; only third-party/untrusted code genuinely breaks build-time federation.
3. Sniff-test on the untrusted-code premise. Same comment, verbatim: "And the premise 'you can sideload any arbitrary JS bundle not controlled by you, without coordination, into your SPA' passes the sniff test." Note: as written this reads as agreement that the untrusted-code case is legitimate, but the sentence sits inside an otherwise skeptical comment and may contain a dropped negation ("hardly passes"). Transcribed verbatim; interpretation is uncertain. Label: verbatim quote; ambiguous intent.
4. Incumbent parity. A commenter who works "in a very mfe heavy space" argued: "Single Spa already supports this. Does this do anything that it doesn't?" The objection pattern: novelty must be stated relative to the established tool, not in the abstract.
5. Prior art. "Have you seen Astro?" functions as a mild you-reinvented-this challenge.

Notably absent from this (small) thread: nobody raised SEO, accessibility, iframe scroll/focus jank, cross-frame auth, or deployment complexity. With n=3 commenters that absence is weak evidence, but the concerns that did surface were 100% "why this over X" positioning questions, zero implementation-detail questions.

## OP's counter-moves (useful for honest-tradeoffs and question phrasing)

- Ownership over technology: "Mfes are not just about splitting code into smaller chunks, but who owns the chunks." (OP claim; aligns with the strongest commenter concession)
- War story as evidence: OP described a prior org (low-code Microsoft-product CMS integration; KnockoutJS, Blazor, jQuery, vanilla JS, React, Angular accreted over 10 years; skeleton crew; overseas teams with misaligned sprints) where "the *only* integration socket available to us was some javascript (with wierd limitations)". Conclusion: "the technical solution should fit the shape of the org." Contrast case from OP's current role: "big firm, big money, they plan out many months ahead, teams are willing and able to align to the specific Angular version."
- The isolation-guarantee probe. When challenged with single-spa, OP conceded unfamiliarity ("So you got me there") and pivoted to one question: "if I embed my app in someone else's host app via single-spa, how does it prevent from touching my DOM/globals/CSS it's not supposed to, is there like a guarantee that's not possible or does it need to rely on code convention?" No commenter answered before removal. This guarantee-vs-convention distinction is the sharpest decision-framework axis in the thread. (The underlying fact that an iframe gives browser-enforced DOM/CSS/global isolation is a browser-guarantee; that single-spa's isolation is convention-based is an OP claim left unverified in-thread.)
- Direction-of-travel framing, to the Astro commenter: "Astro, module federation, single-spa rely on code conventions to keep indepence / clean separtion, no? They also start from cohesion and carve out indepence in some way. Hyperfrontend picks isolation uses protocols and contracts and so on to earn cohesion back." (OP claim/positioning; the Astro characterization went unanswered)
- Tradeoffs OP volunteered unprompted (honest-tradeoffs list seed): no code-deduplication; memory overhead in the browser; "conscious trade-offs I am deliberately choosing when using iframes".

## Praise / curiosity signals

- Thin. Score 10 at ratio 1.0 says nobody downvoted, but no comment expresses praise, and nobody asked about the demo itself (the 3D scene, the 8 frameworks, the drag/drop interactions OP invited people to try). Every commenter went straight to positioning-vs-alternatives.
- The closest thing to a curiosity signal is the shape of the questions: all three commenters engaged seriously enough to name specific alternatives rather than dismissing iframes outright. The "nay sayers of the iframe" provocation in the post drew zero anti-iframe dunking.
- The moderator removal (reason not recorded in the archive) capped reach; likely self-promotion rules rather than content quality (inference; the archive records no removal reason).

## Implications for the decision framework

1. The first question real practitioners ask of an isolation-first MFE demo is "why not Module Federation?", asked within 25 minutes and upvoted to the top. The framework should meet users at that question rather than making them discover the isolation axis themselves. An entry question like "Do you control the build of every piece you're composing?" maps directly onto the one objection row the skeptic conceded ("not owned by you").
2. Practitioners treat framework heterogeneity as a weak justification on its own; "coordinate your build scripts... that's standard practice" is the community counter. The matrix should not let "multiple frameworks" alone route to iframe isolation; the discriminating inputs the thread validates are code ownership, trust boundary, and org coordination capacity (OP's "the technical solution should fit the shape of the org").
3. "Does X already do this?" (single-spa) shows the framework needs explicit parity rows against single-spa, Module Federation, and Astro, with the differentiator stated as guarantee-vs-convention isolation: OP's unanswered probe ("is there like a guarantee that's not possible or does it need to rely on code convention?") is directly reusable as a framework question.
4. Anti-steering seeds from this thread: (a) "memory and speed tradeoffs for what benefit?" must be answerable with a concrete benefit or the framework should route away from iframes; (b) the framework must be able to output "use Module Federation / coordinated builds" for orgs with alignment capacity, since OP himself conceded his current employer is such an org; (c) do not present an org-diversity table as sufficient evidence (a commenter called exactly that "misleading").
5. Honest-tradeoffs list confirmed by the thread: no code-dedup, browser memory overhead, speed cost; these were stipulated by OP and accepted (not contested) by commenters, so the framework can state them as agreed ground rather than arguing them.
6. Caveat on all of the above: n=3 commenters, ~36 hours of exposure, thread removed by moderators; treat these as directional community-convention signals, not statistics.

## Raw comment log (verbatim, chronological)

1. u/morefloordoor, score 4, 2026-08-25 22:36 UTC, top-level: "Specifically… why not module federation? This takes on memory and speed tradeoffs for what benefit?"
2. u/ajrm7 (OP), score 1, 22:41 UTC, reply to 1: "the tldr; Module Federation is a perfectly valid microfrontend stategy for orgs that are willing and able to pay the reocurring cost of coordination. Mfes are not just about splitting code into smaller chunks, but who owns the chunks." [then the org table: Main product React 19 / Billing Angular 17 / Reporting Vue 3 / Admin AngularJS / Legacy configurator jQuery / Partner widget unknown / Customer extension not owned by you] "Module Federation wouldn't be feasible. I wrote a short article about it, comparing both that is. https://www.hyperfrontend.dev/articles/hyperfrontend-vs-module-federation/"
3. u/morefloordoor, score 3, 22:45 UTC, reply to 2: "It's sort of a misleading list, no? The only important item is 'not owned by you'. So long as you coordinate your build scripts there's absolutely no issue, and that's standard practice. And the premise 'you can sideload any arbitrary JS bundle not controlled by you, without coordination, into your SPA' passes the sniff test."
4. u/shrimpcest, score 3, 23:10 UTC, reply to 2: "Single Spa already supports this. Does this do anything that it doesn't? (I work in a very mfe heavy space)"
5. u/ajrm7 (OP), score 1, 23:14 UTC, reply to 3: [war story, quoted in OP's counter-moves above, ending] "Long way of saying the technical solution should fit the shape of the org. You could make an argument for the opposite, provided you have the human capital."
6. u/ajrm7 (OP), score 1, 23:47 UTC, reply to 4: "tbh, I am not super familiar with Single Spa. So you got me there. quick question, if I embed my app in someone else's host app via single-spa, how does it prevent from touching my DOM/globals/CSS it's not supposed to, it there like a guarantee that's not possible or does it need to rely on code convention?"
7. u/Sunstorm84, score 2, 23:49 UTC, reply to 2: "Have you seen Astro?"
8. u/ajrm7 (OP), score 1, 2026-08-26 00:17 UTC, reply to 7: "Astro yeah, very cool. I assume your point is able to hold stitch different frameworks. Hyperfrontend is not ground breaking by any means in that regards. I guess hyperfrontend would be a choice if you want isolation guarantees that are browser enforced, but still let's you coordinate seamless. To me the demo was important, because I wanted to test the limits of the concious trade-offs I am deliberately choosing when using iframes. Astro, module federation, single-spa rely on code conventions to keep indepence / clean separtion, no? They also start from cohesion and carve out indepence in some way. Hyperfrontend picks isolation uses protocols and contracts and so on to earn cohesion back."
