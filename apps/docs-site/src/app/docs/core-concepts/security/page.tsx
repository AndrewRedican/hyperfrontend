import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { CodeBlock } from '@/components/code-block'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'
import { H1, H2, H3 } from '@/components/heading-with-anchor'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Security Model',
  description:
    'The hyperfrontend trust model: who the adversary is, what the browser enforces, what the protocol enforces, what remains the operator’s job, and the status of every control.',
}

export default function SecurityModelPage() {
  return (
    <DocsContentWrapper>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Security Model</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        This is the canonical statement of what hyperfrontend defends against, what it does not, and which party is responsible for each
        control. Every other security claim in these docs is a detail of what follows.
      </p>

      {/* Trust model */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">The trust model</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          A host embeds a feature the way it takes on any dependency: deliberately. Installing a shell is an act of trust, and the design
          does not pretend otherwise: a feature you chose is not treated as an attacker.
        </p>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          What the design does assume is that a trusted feature can have a bad day: a compromised transitive dependency, an injected
          third-party script, a bug that navigates the top-level page. The controls below limit the blast radius of those events without
          treating the feature team as hostile.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">In the model</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>• Other scripts co-resident in either page: analytics snippets, tag managers, chat widgets, compromised dependencies</li>
              <li>• Unknown pages that embed a publicly reachable feature URL</li>
              <li>• Stale traffic from a document that was replaced by a reload or navigation</li>
              <li>• Contract drift between two independently deployed vintages</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">Outside the model</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>• A host application that is itself malicious toward its own feature</li>
              <li>• A fully compromised page, where the attacker is the application</li>
              <li>• Network attackers below TLS</li>
              <li>• The browser, the platform, and their vulnerabilities</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>The load-bearing limitation.</strong> Origin checks authenticate rooms, not speakers. Every script running inside a page
            shares its window, and a message it posts reports that page&apos;s real origin, because that is where it runs. No additional
            message check distinguishes such a script from the application itself. Keeping authority away from a page&apos;s shared
            JavaScript realm is a different job, and it belongs to Content Security Policy, Trusted Types, dependency provenance, and
            server-side authorisation.
          </p>
        </div>
      </section>

      {/* Who enforces what */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Who enforces what</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Three parties carry the security of an embedded feature. Confusing them is the most common way an integration ends up believing it
          is protected by something that was never switched on.
        </p>

        <H3 className="mt-8 text-xl font-semibold text-slate-900 dark:text-white">The browser enforces isolation</H3>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          The same-origin policy keeps the feature&apos;s DOM, JavaScript state, and storage away from the host and the host&apos;s away
          from the feature. This is not a convention that holds until someone is in a hurry; the browser refuses, on every page load. It is
          the reason the boundary is an iframe and not a shared runtime. The browser also enforces the two capability attributes the host
          writes (<code>sandbox</code> and <code>allow</code>) and the <code>frame-ancestors</code> directive the feature&apos;s server
          sends.
        </p>

        <H3 className="mt-8 text-xl font-semibold text-slate-900 dark:text-white">The protocol enforces the relationship</H3>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Isolation says nothing about who is on the other side of the wall or whether what they said is well-formed. That is the
          protocol&apos;s job, and it is shipped behaviour rather than advice:
        </p>
        <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
          <li>
            <strong className="text-slate-900 dark:text-white">Pinned counterparts.</strong> Each side learns the other&apos;s origin during
            the handshake and pins it. Inbound routing resolves by the sending window rather than by claimed identity, and an origin
            mismatch is dropped.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">Instance identity.</strong> Every boot mints an id that is stamped on each
            action, so traffic left over from a document that has been replaced cannot enter the session that replaced it.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">A gated handshake.</strong> Nothing opens without REQUEST → ACCEPT → OPEN.
            Five gates can refuse — invalid contract, missing required actions, security policy, contract incompatibility, and unavailable
            security under a fail-closed channel — and each fires a machine-readable denial on the side that decided.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">Validation on both ends.</strong> A send is validated against the
            sender&apos;s own emitted schemas and throws in the sender&apos;s frame; an arriving message is validated against the
            receiver&apos;s own accepted schemas and is dropped with a diagnosable error. Malformed data never detonates inside the other
            application.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">A versioned contract.</strong> Each side presents the contract vintage it
            bundled, and an incompatible pair is refused before product messages move, instead of going silently deaf weeks later.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">An optional encrypted envelope.</strong> Product traffic can travel inside a
            negotiated envelope; handshake frames stay plaintext. See the status table for what each version actually buys.
          </li>
        </ul>

        <H3 className="mt-8 text-xl font-semibold text-slate-900 dark:text-white">The operator decides authorisation</H3>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Pinning answers <em>am I still talking to the same counterpart I started with?</em> It does not answer{' '}
          <em>was that counterpart ever allowed to embed me?</em> Those are different jobs, and the second one lives outside the protocol
          entirely, at the framing and server boundaries you control:
        </p>
        <CodeBlock language="http" code={'Content-Security-Policy: frame-ancestors https://app.mysite.com'} />
        <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
          <li>
            • <strong className="text-slate-900 dark:text-white">Who may embed the feature</strong>: the <code>frame-ancestors</code>{' '}
            directive on the response that serves the feature document.
          </li>
          <li>
            • <strong className="text-slate-900 dark:text-white">What an authenticated caller may do</strong>: credentials and authorisation
            checks on the feature&apos;s own backend. A message that crossed the boundary is not an authorised operation.
          </li>
          <li>
            • <strong className="text-slate-900 dark:text-white">Whether traffic is encrypted at all</strong>: choosing a protocol version
            and, for <code>v2</code>, provisioning and rotating the pre-shared key. The SDK never bakes a key into an artifact.
          </li>
          <li>
            • <strong className="text-slate-900 dark:text-white">The containment posture</strong>: the sandbox tokens the frame runs under,
            priced against what the product actually needs.
          </li>
          <li>
            • <strong className="text-slate-900 dark:text-white">The page&apos;s own integrity</strong>: HTTPS, Content Security Policy,
            Trusted Types, Subresource Integrity, and dependency provenance on both sides.
          </li>
        </ul>
      </section>

      {/* Capability */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Capability: delegation and containment</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Capability flows one way: from the containing page into the frame. A feature cannot grant itself browser powers. The SDK splits
          that flow along two axes, and they answer different questions.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Delegation: <code>permissions</code>
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <em>What powerful features may this frame use?</em> Feature-declared, host-applied. The feature lists the Permissions-Policy
              features it needs beside its contract; the build bakes them as the shell&apos;s defaults, discloses them in the generated
              README, and stamps them into <code>metadata.json</code> for review. The host applies them as the frame&apos;s{' '}
              <code>allow</code> attribute and may replace the list outright. Reviewable before install, and cheap to keep narrow.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Containment: <code>sandbox</code>
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <em>How large is the blast radius if this frame misbehaves?</em> Host-only, never baked. The SDK manages the two hazardous
              tokens itself: <code>allow-scripts</code> is always granted, and <code>allow-same-origin</code> only to cross-origin feature
              URLs. The pairing that would let a same-origin frame shed its own sandbox is not expressible. Everything else is explicit
              opt-in.
            </p>
          </div>
        </div>

        <p className="mt-6 text-slate-600 dark:text-slate-400">
          Omit <code>permissions</code> and the frame gets exactly what the feature declared at build time. Passing the key replaces that
          grant list rather than extending it.
        </p>

        <CodeBlock
          language="typescript"
          code={`shell.open({
  permissions: ['fullscreen', 'clipboard-write'], // delegation — replaces the list baked in at build time
  sandbox: { downloads: true },                   // containment — the host's call alone
})`}
        />

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Both attributes are written before the frame loads, which is the only moment they take effect, and both apply to the iframe modes
          only: <code>popup</code> and <code>standalone</code> open top-level windows that ask the user for permissions directly. Requesting
          a sandbox on those modes throws.
        </p>
      </section>

      {/* Status */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Status of each control</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          What is on by default, what you have to switch on, and what a control is honestly worth.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-900 dark:border-slate-700 dark:text-white">
              <tr>
                <th className="py-2 pr-4 font-semibold">Control</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 font-semibold">What it is worth</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-slate-400">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Document isolation</td>
                <td className="py-2 pr-4">Browser-enforced, always</td>
                <td className="py-2">The guarantee the whole design is built on. Not optional, not bypassable by either side.</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Origin pinning and window binding</td>
                <td className="py-2 pr-4">On by default</td>
                <td className="py-2">Binds a session to one counterpart. Authenticates the room, not the speaker.</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Instance identity</td>
                <td className="py-2 pr-4">On by default</td>
                <td className="py-2">
                  Keeps stale traffic out of a fresh session. Cooperative in plaintext (forgeable by anything that can post to the window)
                  and authenticated inside a <code>v2</code> envelope.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Handshake gates and reasoned denial</td>
                <td className="py-2 pr-4">On by default</td>
                <td className="py-2">
                  Refuses a session before anything opens, and tells the deciding side why. A policy rejection deliberately discloses
                  nothing to the refused party.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Schema validation, both ends</td>
                <td className="py-2 pr-4">On for actions that carry a schema</td>
                <td className="py-2">Stops malformed payloads at the border. Actions without a schema pass through unchecked.</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Contract version gate</td>
                <td className="py-2 pr-4">Active when both sides carry a version</td>
                <td className="py-2">Makes deployment drift fail loudly. A side without a version always passes.</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">
                  Envelope <code>v1</code>
                </td>
                <td className="py-2 pr-4">Opt-in</td>
                <td className="py-2">
                  Time-window obfuscation with a clock-derived password: no secret is involved, so anything that can read the frames can
                  reverse it. Deterrence against casual inspection, not a confidentiality control.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">
                  Envelope <code>v2</code>
                </td>
                <td className="py-2 pr-4">Opt-in, requires a pre-shared key</td>
                <td className="py-2">
                  The real control: authenticated encryption of product traffic end to end. Handshake frames stay plaintext.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">Fail-closed security</td>
                <td className="py-2 pr-4">
                  Opt-in, on a <code>nexus</code> channel
                </td>
                <td className="py-2">
                  Turns a failed negotiation into a denial instead of a plaintext fallback. Negotiation fails open by default, and the shell
                  surface does not expose the switch; set it when driving the broker directly.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">
                  <code>permissions</code> delegation
                </td>
                <td className="py-2 pr-4">Feature-declared, host-applied</td>
                <td className="py-2">
                  Keeps powerful browser features scoped to the frames that need them, and reviewable before install.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">
                  <code>sandbox</code> containment
                </td>
                <td className="py-2 pr-4">Host-only, off unless requested</td>
                <td className="py-2">
                  Bounds the blast radius of a misbehaving frame. Correct by construction: the self-defeating pairing cannot be expressed.
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-4">
                  <code>frame-ancestors</code>
                </td>
                <td className="py-2 pr-4">Operator-supplied</td>
                <td className="py-2">The only thing that decides who may embed the feature at all. The SDK cannot do this for you.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Backend authorisation</td>
                <td className="py-2 pr-4">Operator-supplied</td>
                <td className="py-2">
                  Decides what an authenticated caller may actually do. A delivered message is not an authorised operation.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Deeper */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Going deeper</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Each control has an implementation, and each implementation has its own guarantees and limitations.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DeeperLink
            href="/articles/microfrontends-from-first-principles"
            title="Microfrontends from First Principles"
            description="Why the boundary is drawn here, derived from scratch. The canonical rationale."
          />
          <DeeperLink
            href="/docs/libraries/features/architecture"
            title="@hyperfrontend/features"
            description="The SDK that applies these controls: handshake, presentation, capability, control plane."
          />
          <DeeperLink
            href="/docs/libraries/nexus/architecture"
            title="@hyperfrontend/nexus"
            description="The session protocol itself: origin filtering, security policy, contract validation, transport security."
          />
          <DeeperLink
            href="/docs/libraries/network-protocol"
            title="@hyperfrontend/network-protocol"
            description="The envelope: queue composition, packet format, and the v1/v2 pipelines."
          />
          <DeeperLink
            href="/docs/libraries/cryptography"
            title="@hyperfrontend/cryptography"
            description="AES-GCM, PBKDF2 key derivation, and time-window password generation."
          />
          <DeeperLink
            href="/docs/libraries/utils/immutable-api"
            title="@hyperfrontend/immutable-api-utils"
            description="Locked API surfaces and built-in copies captured at load time: mitigation for prototype pollution, not prevention."
          />
        </div>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Found a vulnerability? Report it privately; see the{' '}
          <a
            href="https://github.com/AndrewRedican/hyperfrontend/blob/main/SECURITY.md"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            security policy
          </a>{' '}
          for the disclosure process and response timeline.
        </p>
      </section>
    </DocsContentWrapper>
  )
}

type DeeperLinkProps = {
  /** Destination path within the docs site. */
  href: string
  /** Card heading. */
  title: string
  /** One-line explanation of what the target covers. */
  description: string
}

function DeeperLink({ href, title, description }: DeeperLinkProps) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
    >
      <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </Link>
  )
}
