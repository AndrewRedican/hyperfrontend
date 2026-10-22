\\ \a \* \\\
line &#0; &#x110000; &#128512; &#x1F600; &zzzz; &#; &amp

`` `` ` ` `a
b` `unclosed

<https://a.b/?x=1> <mailto:a@b.c> <a@b.cd> <notascheme> <a-b:x>
<span class="x">t</span> <br/> <!---> <!-- c --> <?x?> <!A b> <![CDATA[y]]> </span> <1>

[link](u "double") [l2](u 'single') [l3](u (paren)) [l4](<u v> "t") [l5]() [l6]( u
"t" ) [bad](u "unclosed) [bad2](u (x(y)) [bad3](a b) ![img *a* `c`](i "t")
[outer [inner](i) rest](o) [![alt](i)](l) [full][ref] [collapsed][] [ref] ![iref][ref] ![icol][] ![ishort]
[missing][nope] [nope] [^undefined] [^1] [a[b]] [a\]b]

[ref]: <https://example.com/x y> 'T'
[collapsed]: /c
"not a definition"
[icol]: /i (paren title)
[ishort]: /s
[next]:
/next-line
[titled]: /t
"title on next line"
[broken]: /b extra
[^1]: note

*em* **strong** ***both*** _u_ __uu__ *a *b* c* **a *b* c** *a **b** c* ~~a *b* c~~
foo*bar*baz foo_bar_baz _foo_bar snake_case_word *(x)* a * b * c **
~x~ ~~y~~ ~~~z~~~ ~a~~b~~c~ *x**y* **x*y**
line  
break\
end\
trailing  

https://a.b/c&amp; https://a.b/(c) www.a.b)x hhttps://x.y www.a_b.c www.a.b_c https://a.b. ahttps://a.b
a@b.c. x@y-.com q@z.co- 1@2.c/d me@a.b,c
[e](u&amp;v "t&copy;") [sp][sp] <a href=x>t</a> <b c="unclosed> <d e=> <@x.y> <br x/> <a _b:c.d-e='f' g = "h"> </1> http:// y [esc](u\)v "t\"q") [t2](<u>)

[ctl]: /ab

[sp]: /s "t"
[a\]b]: /x
[p]: /a(b)c

[a[b]: /y

[q]: /a)b

[u]: /x "unclosed

[no close

</a x> <z q="never
