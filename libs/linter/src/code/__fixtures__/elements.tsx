const simple = <div />
const nested = (
  <section className="wrap" data-id={id} aria-hidden hyphen-ated="x" ns:attr="y" {...spread} multi="a
b">
    text &amp; entities &#65; &#x42; &unknown; more
    {expression}
    {/* a comment only */}
    {}
    <Inner.Member prop={<span>child</span>}>
      <>fragment {inside}</>
    </Inner.Member>
    {...spreadChild}
    {list.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </section>
)
const generic = <T,>(value: T) => value
const typed = <Component<string> prop="x" />
const elementValue = <a attr=<c /> />
const selfClosingChild = <p><br /><img src="x" /></p>
const stringChild = <a>{'text'}</a>
const comparison = a < b
const emptyText = <b></b>
const nestedSameLine = <ul><li>one</li><li>two</li></ul>
const withNewlines = (
  <div>
    <span>a</span>

    <span>b</span>
  </div>
)
const svg = <svg:circle xlink:href="#id" />
const cast = value as number
function Component() {
  return <div>{this}</div>
}
