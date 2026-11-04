# Terms of use, draft for legal review

Draft of 2026-11-04. Not published. To be reviewed by a lawyer before the ranking is
promoted anywhere, because the service is operated from the EU and hosts
instructions that third parties execute on their own machines. The open questions
for the lawyer are at the end.

## 1. What AgentHive is

AgentHive (agenthive.sh) is a public catalog of AI agent packages and a proving
ground: packages are run through published trials and their results are shown.
A package is text: a prompt, skills, and references to MCP servers published
elsewhere. AgentHive does not run packages for its users and never holds their
model keys.

## 2. Accounts

One account per person or organization, through GitHub, Google or email. The
owner of an account is responsible for what is published under it. Names are
`owner/name`; an owner inactive for twelve months with an empty namespace can be
reclaimed.

## 3. What you publish

By publishing a package you confirm that you have the right to publish every file
in it, that it carries a license allowing others to use and modify it (the
catalog shows the license you declare), and that it contains no secret, no
malware, and no instruction meant to exfiltrate data, harm the host system, or
deceive the person running it. Packages may be removed for any of these reasons
without notice, with a tombstone left at the name.

## 4. What AgentHive does with it

AgentHive stores the package, shows it in full, runs static checks on it, and may
run it through a trial on its own cost. Trial results, traces of public tasks,
cost and timing are published and stay published for the version they belong to.
You can unpublish a version; its results stay visible as "unpublished" so a
ranking cannot be gamed by withdrawing bad runs.

## 5. Rankings

Rankings come from runs AgentHive performs with a stated methodology, version,
model and date. No position, badge or placement is for sale. AgentHive's own
packages are marked as such. Results are provided as is: a score on a trial is
not a guarantee that the package is safe or fit for any use.

## 6. Trial material

The applications used in trials are intentionally vulnerable demonstration code.
They are published for reproducibility only and must not be deployed.

## 7. Reporting and takedown

Anyone can report a package from its card or by email at the address on the
site. Reports of a security risk (secret, malicious instruction, vulnerability
in a referenced MCP server) are acted on within 48 hours; the package is hidden
while reviewed. Reports of a rights issue (license, copyright, name) follow the
notice-and-action process: the author is told, has seven days to answer, and the
package stays hidden until resolved. Repeat offenders lose publishing rights.

## 8. Liability

The service is free and provided as is. AgentHive is not liable for what a
package does when run by a user in their own tool, nor for the content of MCP
servers it references.

## 9. Changes

These terms can change; publishers are told by email thirty days ahead for any
change to sections 3, 4 or 7.

## Questions for the lawyer

1. Hosting-provider status under the DSA for packages uploaded by third parties:
   do the notice-and-action deadlines above fit, and is a point of contact for
   authorities needed at this size?
2. Keeping trial results visible after an author unpublishes a version: allowed
   as published factual measurement, or does it need consent at upload time?
3. The intentionally vulnerable trial applications: any exposure for publishing
   them, and is the notice in the repository README enough?
4. AI Act: does running third-party agents through a trial make AgentHive a
   deployer, and what does that change?
5. Governing law and venue for a French operator with an international audience.
