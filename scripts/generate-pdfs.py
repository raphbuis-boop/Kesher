#!/usr/bin/env python3
"""
Generate production-grade 10DLC compliance PDFs for Kesher.
Saves all PDFs directly to ~/Desktop.
Uses Chrome headless for rendering.
"""

import subprocess
import tempfile
import os
import sys
import time

DESKTOP = os.path.expanduser("~/Desktop")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
EFFECTIVE_DATE = "July 6, 2026"

CSS = """
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page {
    size: letter;
    margin: 0.85in 0.9in 0.9in 0.9in;
    @bottom-center {
      content: "© 2026 Kesher  ·  kesherhq.co";
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
      font-size: 9px;
      color: #9ca3af;
    }
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
      font-size: 9px;
      color: #9ca3af;
    }
  }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #27272a;
    background: #fff;
  }
  /* ── Document header ── */
  .doc-header {
    border-bottom: 1.5px solid #e4e4e7;
    padding-bottom: 28px;
    margin-bottom: 36px;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
  }
  .k-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #0f0f0f;
    border-radius: 7px;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }
  .brand-text { line-height: 1.25; }
  .brand-name {
    font-size: 13px;
    font-weight: 600;
    color: #0f0f0f;
    letter-spacing: -0.01em;
  }
  .brand-tagline {
    font-size: 10px;
    color: #a1a1aa;
    margin-top: 1px;
  }
  .doc-title {
    font-size: 22pt;
    font-weight: 700;
    color: #0f0f0f;
    letter-spacing: -0.025em;
    line-height: 1.15;
    margin-bottom: 8px;
  }
  .doc-dates {
    display: flex;
    gap: 24px;
    font-size: 9.5pt;
    color: #a1a1aa;
    margin-top: 8px;
  }
  /* ── Sections ── */
  section {
    margin-bottom: 32px;
    page-break-inside: avoid;
  }
  h2 {
    font-size: 11pt;
    font-weight: 600;
    color: #0f0f0f;
    letter-spacing: -0.01em;
    margin-bottom: 10px;
    margin-top: 4px;
  }
  h3 {
    font-size: 10pt;
    font-weight: 600;
    color: #3f3f46;
    margin-bottom: 6px;
    margin-top: 14px;
  }
  p { margin-bottom: 10px; }
  p:last-child { margin-bottom: 0; }
  ul, ol {
    margin: 8px 0 8px 20px;
  }
  li { margin-bottom: 5px; }
  strong { font-weight: 600; color: #18181b; }
  em { font-style: italic; }
  a { color: #2563eb; text-decoration: underline; }
  /* ── Highlighted box ── */
  .highlight-box {
    background: #f4f4f5;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    padding: 16px 18px;
    margin: 14px 0;
    font-size: 10.5pt;
  }
  .highlight-box.important {
    background: #fafafa;
    border-color: #a1a1aa;
    border-left: 3px solid #0f0f0f;
    border-radius: 0 8px 8px 0;
  }
  /* ── Quick reference grid ── */
  .qr-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }
  .qr-cell {
    background: #f4f4f5;
    border-radius: 7px;
    padding: 10px 12px;
  }
  .qr-keyword { font-weight: 600; font-size: 10.5pt; color: #0f0f0f; }
  .qr-desc { font-size: 9pt; color: #71717a; margin-top: 2px; }
  /* ── Step list ── */
  .step-list { list-style: none; margin: 0; padding: 0; }
  .step-item {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: flex-start;
  }
  .step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #0f0f0f;
    color: #fff;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 2px;
  }
  /* ── Sample message box ── */
  .sample-box {
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    padding: 12px 14px;
    margin: 10px 0;
    background: #fff;
  }
  .sample-label {
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #a1a1aa;
    margin-bottom: 6px;
  }
  .sample-text { font-size: 10.5pt; color: #3f3f46; font-style: italic; }
  /* ── Footer ── */
  .doc-footer {
    border-top: 1px solid #e4e4e7;
    padding-top: 18px;
    margin-top: 40px;
    font-size: 9pt;
    color: #a1a1aa;
  }
  address { font-style: normal; }
  address p { margin-bottom: 4px; }
"""

def make_html(title, body_html):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Kesher</title>
<style>{CSS}</style>
</head>
<body>
<div class="doc-header">
  <div class="brand-row">
    <div class="k-mark">K</div>
    <div class="brand-text">
      <div class="brand-name">Kesher</div>
      <div class="brand-tagline">The modern communications platform for schools.</div>
    </div>
  </div>
  <div class="doc-title">{title}</div>
  <div class="doc-dates">
    <span>Effective {EFFECTIVE_DATE}</span>
    <span>Last Updated {EFFECTIVE_DATE}</span>
  </div>
</div>
{body_html}
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Document 1: Privacy Policy
# ─────────────────────────────────────────────────────────────────────────────

PRIVACY_BODY = """
<section>
<h2>1. About This Policy</h2>
<p>Kesher ("Kesher", "we", "us", or "our") operates a school communications platform that enables educational institutions to communicate with their communities via email, SMS, and WhatsApp. This Privacy Policy explains how we collect, use, share, and protect information when schools and their authorized administrators ("School Users") use the Kesher platform, and when members of a school community ("Recipients") receive communications sent through Kesher.</p>
<p>By using our platform or receiving messages sent through it, you acknowledge this Privacy Policy. If you are a School User, your use of Kesher is also governed by your school's agreement with us.</p>
</section>

<section>
<h2>2. Information We Collect</h2>
<h3>From School Administrators</h3>
<ul>
<li>Name, email address, and login credentials</li>
<li>School name, address, and contact information</li>
<li>Billing and subscription information</li>
<li>Usage data and activity logs within the platform</li>
</ul>
<h3>From School Community Members (Recipients)</h3>
<p>Schools import contact information for their communities into Kesher. This may include:</p>
<ul>
<li>Full name</li>
<li>Email address</li>
<li>Mobile phone number (used for SMS and WhatsApp messaging)</li>
<li>Relationship to the school (e.g., parent, student, staff, alumni)</li>
<li>Graduation year or grade level</li>
<li>Mailing address</li>
</ul>
<h3>Automatically Collected Information</h3>
<ul>
<li>Message delivery status and timestamps (delivered, opened, clicked, replied)</li>
<li>Opt-in and opt-out records for SMS messaging</li>
<li>IP addresses and device information for security purposes</li>
<li>Log data from platform usage</li>
</ul>
</section>

<section>
<h2>3. How We Use Your Information</h2>
<ul>
<li>To transmit communications on behalf of schools to their authorized Recipients</li>
<li>To track message delivery, engagement, and analytics for school administrators</li>
<li>To process opt-out requests and maintain suppression lists</li>
<li>To provide customer support and respond to inquiries</li>
<li>To improve and secure the platform</li>
<li>To comply with legal obligations, including carrier and regulatory requirements</li>
</ul>
</section>

<section>
<h2>4. SMS Text Messaging Program</h2>
<div class="highlight-box important">
<strong>Critical SMS Data Disclosure:</strong><br>
No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All other categories of information described in this Privacy Policy exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
</div>
<h3>Program Description</h3>
<p>Kesher enables schools to send SMS text messages to parents, guardians, students, staff, alumni, and other authorized community members. Messages are sent on behalf of individual schools; the school is responsible for obtaining appropriate consent from its community members before sending SMS through Kesher.</p>
<h3>SMS Consent</h3>
<p>Recipients receive SMS messages because their school has their phone number on file and has determined they have consented to receive school communications. Message frequency varies based on school activity and needs. Schools are responsible for maintaining accurate consent records for their community.</p>
<h3>Message and Data Rates</h3>
<p>Message and data rates may apply. Contact your mobile carrier for details.</p>
<h3>How to Opt Out of SMS</h3>
<p>You may opt out of SMS messages at any time by replying <strong>STOP</strong> to any text message you receive. You will receive a single confirmation message and no further messages will be sent. To opt back in, reply <strong>UNSTOP</strong> or <strong>START</strong>. For help, reply <strong>HELP</strong> or contact us at privacy@kesherhq.co.</p>
<h3>Supported Keywords</h3>
<p><strong>STOP</strong> — Opt out of all messages. Confirmation sent immediately. No further messages.<br>
<strong>UNSTOP / START</strong> — Re-subscribe to messages.<br>
<strong>HELP</strong> — Receive contact information and support details.</p>
<h3>No Sharing of SMS Opt-In Data</h3>
<p>We do not sell, rent, or lease mobile phone numbers or SMS consent records to any third party. We do not use phone numbers collected through SMS opt-in for any purpose other than delivering school communications on behalf of the school that collected the number.</p>
</section>

<section>
<h2>5. How We Share Information</h2>
<p>We do not sell, rent, or trade personal information. We may share information only in the following limited circumstances:</p>
<ul>
<li><strong>With the school:</strong> School administrators have access to the contact data and messaging analytics for their own school community.</li>
<li><strong>With service providers:</strong> We work with vetted third-party providers to deliver messaging services (including SMS carriers), host our infrastructure, and process payments. These providers are contractually prohibited from using your data for any purpose other than providing services to us.</li>
<li><strong>Legal requirements:</strong> We may disclose information if required by law, court order, or governmental authority, or to protect the rights and safety of Kesher, our users, or the public.</li>
<li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, contact information may be transferred. We will notify affected parties in advance.</li>
</ul>
<p><strong>Mobile phone numbers and SMS opt-in data are explicitly excluded from any third-party sharing for marketing or promotional purposes.</strong></p>
</section>

<section>
<h2>6. Student Data and FERPA</h2>
<p>To the extent Kesher processes education records as defined under the Family Educational Rights and Privacy Act (FERPA), we do so solely as a service provider to the school and only at the school's direction. Schools retain control over their students' education records. Kesher does not use student data for any purpose other than providing the services requested by the school, and does not disclose student data to third parties except as directed by the school or as required by law.</p>
</section>

<section>
<h2>7. Data Security</h2>
<p>We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security reviews. However, no method of transmission over the internet or electronic storage is 100% secure. We encourage School Users to protect their login credentials and notify us immediately of any suspected unauthorized access.</p>
</section>

<section>
<h2>8. Data Retention</h2>
<p>We retain contact and messaging data for as long as a school maintains an active account with Kesher. SMS opt-out records (suppression lists) are retained indefinitely to ensure we do not re-contact opted-out individuals. Upon account termination, schools may request deletion of their data in accordance with our data retention policy. Certain data may be retained longer if required by law.</p>
</section>

<section>
<h2>9. Your Rights</h2>
<p>Depending on your location, you may have rights to:</p>
<ul>
<li>Access the personal information we hold about you</li>
<li>Request correction of inaccurate information</li>
<li>Request deletion of your information (subject to legal retention requirements)</li>
<li>Opt out of SMS communications at any time by replying STOP</li>
<li>Contact your school directly to update or remove your contact information</li>
</ul>
<p>To exercise these rights, contact us at privacy@kesherhq.co. For information stored by your school, please contact the school directly.</p>
</section>

<section>
<h2>10. Children's Privacy</h2>
<p>Kesher is a platform used by schools to communicate with their communities. When schools send communications to students who are minors, the school is responsible for ensuring that appropriate parental or guardian consent has been obtained. We do not knowingly collect personal information directly from children under the age of 13 without parental consent.</p>
</section>

<section>
<h2>11. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify School Users of material changes by email or by posting a notice on the platform. The effective date at the top of this page indicates when the policy was last updated. Your continued use of Kesher after changes are posted constitutes your acceptance of the updated policy.</p>
</section>

<section>
<h2>12. Contact Us</h2>
<p>If you have questions about this Privacy Policy or how we handle your information, please contact us:</p>
<address>
<p><strong>Kesher</strong></p>
<p>Email: <a href="mailto:privacy@kesherhq.co">privacy@kesherhq.co</a></p>
<p>Website: <a href="https://www.kesherhq.co">https://www.kesherhq.co</a></p>
</address>
<p style="margin-top:10px;">For SMS opt-out, reply <strong>STOP</strong> to any message, or email us at privacy@kesherhq.co with your phone number and the school name.</p>
</section>
"""

# ─────────────────────────────────────────────────────────────────────────────
# Document 2: SMS Terms & Conditions
# ─────────────────────────────────────────────────────────────────────────────

SMS_TERMS_BODY = """
<section>
<h2>Program Description</h2>
<p>Kesher ("Kesher") provides a school communications platform that enables educational institutions to send SMS text messages to their communities — including parents, guardians, students, staff, alumni, and other authorized school community members.</p>
<p>Messages sent through Kesher may include: school event notifications, emergency alerts, attendance reminders, administrative announcements, schedule updates, fundraising information, and general school communications. Messages are sent on behalf of your school. The school name or identifier will be included in each message.</p>
</section>

<section>
<h2>Consent to Receive Messages</h2>
<div class="highlight-box">
<p>You are receiving SMS messages because your school has your phone number on file and has indicated that you have consented to receive communications from your school community. Your school is responsible for obtaining and maintaining appropriate consent from its community members.</p>
<p style="margin-top:8px;">By not opting out, you confirm that you consent to receive SMS text messages from your school via the Kesher platform. <strong>Consent is not a condition of any purchase or enrollment.</strong></p>
</div>
</section>

<section>
<h2>Message Frequency</h2>
<p>Message frequency varies based on your school's activity and communication needs. You may receive multiple messages per week during active school periods.</p>
</section>

<section>
<h2>Message and Data Rates</h2>
<p><strong>Message and data rates may apply.</strong> Please check with your mobile service provider for details about your plan's SMS rates. Kesher and your school do not charge a fee for SMS messages, but your carrier may.</p>
<p style="font-size:9.5pt; color:#71717a; margin-top:8px;">Participating carriers include AT&amp;T, T-Mobile, Verizon, and others. Carrier availability and rates may vary. Carriers are not liable for delayed or undelivered messages.</p>
</section>

<section>
<h2>How to Opt Out (STOP)</h2>
<div class="highlight-box important">
<p>You may opt out of SMS messages at any time by replying <strong>STOP</strong> to any text message. After opting out, you will receive one final confirmation message and no further messages will be sent to your number.</p>
<p style="margin-top:8px;">Opt-out requests are processed immediately. STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, and QUIT are all recognized opt-out keywords.</p>
<p style="margin-top:8px;">To re-subscribe after opting out, reply <strong>UNSTOP</strong> or <strong>START</strong>.</p>
</div>
</section>

<section>
<h2>How to Get Help (HELP)</h2>
<p>Reply <strong>HELP</strong> to any message to receive support contact information. You can also reach us at:</p>
<address>
<p>Email: <a href="mailto:help@kesherhq.co">help@kesherhq.co</a></p>
<p>Website: <a href="https://www.kesherhq.co">https://www.kesherhq.co</a></p>
</address>
<p style="margin-top:8px;">For issues with messages from a specific school, please contact your school's administrative office directly.</p>
</section>

<section>
<h2>Your Phone Number and Privacy</h2>
<p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong></p>
<p style="margin-top:8px;">All other categories of information described in our Privacy Policy exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
<p style="margin-top:8px;">Please review our full Privacy Policy at <a href="https://www.kesherhq.co/privacy">kesherhq.co/privacy</a> for complete details on how we collect, use, and protect your information.</p>
</section>

<section>
<h2>Limitation of Liability</h2>
<p>Kesher is not liable for any delays or failures in the receipt of SMS messages. Delivery is subject to valid mobile service coverage and carrier network conditions. Carriers reserve the right to refuse, alter, or terminate any SMS service at any time.</p>
</section>

<section>
<h2>Changes to These Terms</h2>
<p>We may update these SMS Terms from time to time. Material changes will be communicated through the platform or by email to school administrators. Continued use of the messaging service after changes constitutes acceptance of the updated terms.</p>
</section>

<section>
<h2>Contact</h2>
<address>
<p><strong>Kesher</strong></p>
<p>Email: <a href="mailto:help@kesherhq.co">help@kesherhq.co</a></p>
<p>Website: <a href="https://www.kesherhq.co">https://www.kesherhq.co</a></p>
</address>
</section>

<section>
<h2>Quick Reference</h2>
<div class="qr-grid">
  <div class="qr-cell">
    <div class="qr-keyword">STOP</div>
    <div class="qr-desc">Opt out of all messages</div>
  </div>
  <div class="qr-cell">
    <div class="qr-keyword">UNSTOP / START</div>
    <div class="qr-desc">Re-subscribe to messages</div>
  </div>
  <div class="qr-cell">
    <div class="qr-keyword">HELP</div>
    <div class="qr-desc">Get support information</div>
  </div>
  <div class="qr-cell">
    <div class="qr-keyword">Msg &amp; Data Rates May Apply</div>
    <div class="qr-desc">Check with your carrier</div>
  </div>
</div>
</section>
"""

# ─────────────────────────────────────────────────────────────────────────────
# Document 3: Terms of Service
# ─────────────────────────────────────────────────────────────────────────────

TERMS_BODY = """
<section>
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using the Kesher platform ("Service") operated by Kesher ("we", "us", or "our"), you agree to be bound by these Terms of Service ("Terms"). If you are using Kesher on behalf of a school or organization, you represent that you have authority to bind that organization to these Terms.</p>
<p style="margin-top:8px;">If you do not agree to these Terms, do not use the Service.</p>
</section>

<section>
<h2>2. Description of Service</h2>
<p>Kesher is a school communications platform that enables educational institutions to manage their community directories and send communications — including email, SMS, and WhatsApp messages — to parents, guardians, students, staff, alumni, and other authorized school community members.</p>
</section>

<section>
<h2>3. Account Registration</h2>
<p>Access to the Kesher platform requires registration and approval. School administrators are responsible for maintaining the security of their login credentials and for all activity that occurs under their account. You must notify us immediately at <a href="mailto:help@kesherhq.co">help@kesherhq.co</a> of any unauthorized use of your account.</p>
</section>

<section>
<h2>4. Acceptable Use</h2>
<p>You agree to use Kesher only for lawful school communications purposes. You may not use the Service to:</p>
<ul>
<li>Send unsolicited bulk messages (spam)</li>
<li>Send messages to individuals who have opted out or requested not to be contacted</li>
<li>Transmit content that is abusive, threatening, harassing, or unlawful</li>
<li>Violate any applicable law or regulation, including TCPA, CAN-SPAM, or CTIA guidelines</li>
<li>Impersonate any person or organization</li>
<li>Collect or harvest contact information for any purpose other than school communications</li>
<li>Resell, sublicense, or otherwise commercialize access to the Service</li>
</ul>
</section>

<section>
<h2>5. SMS Messaging</h2>
<p>Schools are solely responsible for ensuring that recipients have consented to receive SMS messages before importing phone numbers into Kesher. By sending SMS through the Service, you represent and warrant that:</p>
<ul>
<li>You have obtained appropriate consent from all SMS recipients</li>
<li>You will honor all opt-out requests immediately</li>
<li>Your messages comply with TCPA, CTIA Messaging Principles, and all applicable carrier requirements</li>
<li>You will maintain accurate consent records as required by law</li>
</ul>
<p style="margin-top:8px;">Please review our SMS Terms &amp; Conditions at <a href="https://www.kesherhq.co/sms-terms">kesherhq.co/sms-terms</a> for full details on our SMS messaging program and opt-out procedures.</p>
</section>

<section>
<h2>6. Data and Privacy</h2>
<p>Your use of Kesher is subject to our Privacy Policy at <a href="https://www.kesherhq.co/privacy">kesherhq.co/privacy</a>, which is incorporated into these Terms by reference. You retain ownership of all contact data you upload to Kesher. By uploading data, you grant us the limited right to process that data solely for the purpose of providing the Service.</p>
</section>

<section>
<h2>7. Intellectual Property</h2>
<p>The Kesher platform, including its design, software, and content, is owned by Kesher and protected by intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service without our express written permission.</p>
</section>

<section>
<h2>8. Service Availability</h2>
<p>We strive to maintain high availability but do not guarantee uninterrupted access to the Service. We may perform maintenance, updates, or modifications that temporarily affect availability. We will provide reasonable notice of planned downtime where possible.</p>
</section>

<section>
<h2>9. Disclaimers</h2>
<p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, KESHER DISCLAIMS ALL WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
<p style="margin-top:8px;">We are not responsible for the content of messages sent by schools through the platform, or for the accuracy of contact information uploaded by schools.</p>
</section>

<section>
<h2>10. Limitation of Liability</h2>
<p>TO THE FULLEST EXTENT PERMITTED BY LAW, KESHER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.</p>
</section>

<section>
<h2>11. Termination</h2>
<p>We may suspend or terminate your access to the Service at any time for violation of these Terms, non-payment, or any other reason with reasonable notice. You may request account deletion by contacting us. Upon termination, you may request an export of your data within 30 days.</p>
</section>

<section>
<h2>12. Modifications</h2>
<p>We may update these Terms from time to time. Material changes will be communicated by email to registered administrators or by notice on the platform. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
</section>

<section>
<h2>13. Governing Law</h2>
<p>These Terms are governed by the laws of the State of New Jersey, United States, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved through binding arbitration or in the courts of New Jersey, as applicable.</p>
</section>

<section>
<h2>14. Contact</h2>
<p>Questions about these Terms? Contact us:</p>
<address>
<p><strong>Kesher</strong></p>
<p>Email: <a href="mailto:help@kesherhq.co">help@kesherhq.co</a></p>
<p>Website: <a href="https://www.kesherhq.co">https://www.kesherhq.co</a></p>
</address>
</section>
"""

# ─────────────────────────────────────────────────────────────────────────────
# Document 4: Call-to-Action Documentation
# ─────────────────────────────────────────────────────────────────────────────

CTA_BODY = """
<section>
<h2>1. Program Overview</h2>
<p>Kesher operates an A2P (Application-to-Person) SMS messaging platform designed exclusively for educational institutions. Schools use Kesher to communicate with their communities — including parents, guardians, students, staff, alumni, and other authorized school community members.</p>
<p style="margin-top:8px;">Kesher operates as a messaging service provider on behalf of individual schools. Each school is the Message Originator responsible for obtaining, documenting, and maintaining consent from message recipients before importing contact information into the Kesher platform.</p>
<p style="margin-top:8px;">All SMS messages sent through Kesher are transactional or informational school communications. Kesher does not send marketing or promotional messages on its own behalf.</p>
</section>

<section>
<h2>2. Opt-In Method</h2>
<p>Kesher uses a <strong>school-facilitated explicit opt-in model</strong>. Consent is obtained by the school (Message Originator) directly from each recipient prior to that recipient's phone number being imported into Kesher. The following methods are used:</p>
<ul>
<li><strong>Annual Enrollment / Re-Enrollment Forms:</strong> Schools include a written or digital SMS consent checkbox on student enrollment and annual re-enrollment forms.</li>
<li><strong>Emergency Contact Update Forms:</strong> Schools collect updated phone numbers and SMS consent through emergency contact forms distributed annually.</li>
<li><strong>School Website / Parent Portal Registration:</strong> Schools with online portals include an SMS opt-in checkbox during account creation or profile updates.</li>
<li><strong>Staff and Faculty Onboarding:</strong> New staff and faculty provide SMS consent as part of the hiring or onboarding process.</li>
</ul>
</section>

<section>
<h2>3. Sample Call-to-Action Language</h2>
<p>The following are the recommended CTA templates that Kesher provides to schools:</p>

<div class="sample-box">
<div class="sample-label">Sample CTA — Annual Enrollment Form</div>
<div class="sample-text">
&#9744; <strong>I consent to receive SMS text messages</strong> from <em>[School Name]</em> via Kesher, our school communications platform. Messages may include school announcements, emergency alerts, event reminders, attendance updates, and other school-related communications. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to opt out at any time. Reply <strong>HELP</strong> for help. View our privacy policy at kesherhq.co/privacy.
</div>
</div>

<div class="sample-box" style="margin-top:12px;">
<div class="sample-label">Sample CTA — School Website / Parent Portal</div>
<div class="sample-text">
&#9744; <strong>Text Alerts:</strong> I agree to receive text (SMS) messages from <em>[School Name]</em> to the mobile number provided above. These messages are sent through Kesher, a school communications platform, and may include important school announcements, emergency notifications, event reminders, and attendance alerts. Msg &amp; data rates may apply. Frequency varies. Reply <strong>STOP</strong> to opt out. For support, reply <strong>HELP</strong> or contact help@kesherhq.co.
</div>
</div>
</section>

<section>
<h2>4. Required CTA Elements</h2>
<p>All school-facing CTAs must include the following elements per CTIA Messaging Principles and TCPA requirements:</p>
<ul>
<li>Identity of the message sender (school name and/or Kesher)</li>
<li>Description of the types of messages to be received</li>
<li>Disclosure that message and data rates may apply</li>
<li>Disclosure of message frequency or that frequency varies</li>
<li>Instructions for opting out (STOP keyword)</li>
<li>Instructions for getting help (HELP keyword or support contact)</li>
<li>Link to privacy policy</li>
<li>Statement that consent is not a condition of purchase or enrollment</li>
</ul>
</section>

<section>
<h2>5. Import Certification</h2>
<p>Before importing any phone number list into Kesher, school administrators must affirmatively certify:</p>
<div class="highlight-box important">
<em>"By importing these contacts, I certify that all individuals on this list have provided explicit, written or digital consent to receive SMS text messages from our school via the Kesher platform. I acknowledge that it is the school's responsibility to maintain accurate consent records and to honor all opt-out requests in accordance with TCPA and CTIA guidelines."</em>
</div>
<p style="margin-top:8px;">This certification is required at the time of every contact import.</p>
</section>

<section>
<h2>6. Message Types</h2>
<p>Messages sent through Kesher are limited to:</p>
<ul>
<li>Emergency alerts and safety notifications</li>
<li>School event announcements and reminders</li>
<li>Attendance and absence notifications</li>
<li>Administrative announcements from school leadership</li>
<li>Schedule changes and closures</li>
<li>Fundraising and community event information</li>
<li>General school community communications</li>
</ul>
<p style="margin-top:8px;">Kesher does not support or permit marketing, promotional, political, or unsolicited commercial messages.</p>
</section>

<section>
<h2>7. Sample Messages</h2>
<div class="sample-box">
<div class="sample-label">Sample Message 1 — Event Reminder</div>
<div class="sample-text">[School Name]: Parent-Teacher conferences are tomorrow, Thu 3/20, 4–8 PM. Sign up at school.edu/conferences. Reply STOP to opt out.</div>
</div>
<div class="sample-box" style="margin-top:10px;">
<div class="sample-label">Sample Message 2 — Emergency Alert</div>
<div class="sample-text">[School Name] ALERT: School will be closed tomorrow, Fri 1/17, due to inclement weather. All after-school programs are also cancelled. Stay safe. Reply STOP to opt out.</div>
</div>
<div class="sample-box" style="margin-top:10px;">
<div class="sample-label">Sample Message 3 — General Announcement</div>
<div class="sample-text">[School Name]: Registration for the 2025–26 school year opens next Monday. Visit school.edu/register or contact the office at 555-000-0000. Reply STOP to opt out.</div>
</div>
</section>

<section>
<h2>8. Opt-Out Processing</h2>
<p>When a recipient replies STOP (or any recognized opt-out keyword), the system immediately:</p>
<ul>
<li>Marks the phone number as opted-out in the Kesher database</li>
<li>Sends a single confirmation message</li>
<li>Suppresses that number from all future sends for that school</li>
<li>Records the opt-out timestamp and keyword received</li>
</ul>
<p style="margin-top:8px;">Recognized opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT.</p>
<p style="margin-top:8px;">Opt-out records are retained indefinitely.</p>
</section>

<section>
<h2>9. HELP Response</h2>
<div class="sample-box">
<div class="sample-label">Automated HELP Response</div>
<div class="sample-text">[School Name] via Kesher School Comms. For support: help@kesherhq.co or kesherhq.co. Msg &amp; data rates may apply. Reply STOP to opt out.</div>
</div>
</section>

<section>
<h2>10. Privacy</h2>
<p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> Text messaging originator opt-in data and consent will not be shared with any third parties.</p>
</section>

<section>
<h2>11. Contact</h2>
<address>
<p><strong>Kesher</strong></p>
<p>Email: <a href="mailto:help@kesherhq.co">help@kesherhq.co</a></p>
<p>Website: <a href="https://www.kesherhq.co">https://www.kesherhq.co</a></p>
</address>
</section>
"""

# ─────────────────────────────────────────────────────────────────────────────
# Document 5: SMS Opt-In Documentation
# ─────────────────────────────────────────────────────────────────────────────

OPT_IN_BODY = """
<section>
<h2>1. Purpose</h2>
<p>This document describes the SMS opt-in process for the Kesher school communications platform. It is intended to satisfy the opt-in documentation requirements of The Campaign Registry (TCR), US wireless carriers, CTIA Messaging Principles and Best Practices, and the Telephone Consumer Protection Act (TCPA).</p>
<p style="margin-top:8px;">Kesher operates an A2P (Application-to-Person) 10DLC SMS messaging platform. All SMS messages are sent on behalf of educational institutions (schools). Schools are the Message Originators and are solely responsible for collecting, documenting, and maintaining consent from their message recipients.</p>
</section>

<section>
<h2>2. Consent Model</h2>
<p>Kesher uses a <strong>school-facilitated explicit single opt-in model</strong>. The consent chain operates as follows:</p>
<ul class="step-list">
  <li class="step-item">
    <div class="step-num">1</div>
    <div><strong>School Collects Consent.</strong> The school collects explicit written or digital SMS consent directly from the recipient via an enrollment form, parent portal, onboarding document, or equivalent consent mechanism. The consent clearly identifies the school as the sender, describes the message types, and includes all required CTIA disclosures.</div>
  </li>
  <li class="step-item">
    <div class="step-num">2</div>
    <div><strong>School Imports Contacts to Kesher.</strong> The school administrator imports consented phone numbers into the Kesher platform. At the time of import, the administrator must affirmatively certify that all imported contacts have provided explicit consent.</div>
  </li>
  <li class="step-item">
    <div class="step-num">3</div>
    <div><strong>Kesher Records and Processes Consent.</strong> Upon import, Kesher records the timestamp, importing administrator, and the certification acknowledgment in its database, creating an auditable record.</div>
  </li>
  <li class="step-item">
    <div class="step-num">4</div>
    <div><strong>Messages Are Sent.</strong> School administrators compose and send SMS campaigns. Kesher automatically appends "Reply STOP to opt out." to every outbound SMS message.</div>
  </li>
  <li class="step-item">
    <div class="step-num">5</div>
    <div><strong>Opt-Outs Are Processed Immediately.</strong> Any recipient who replies STOP is immediately removed from all future messaging. The opt-out is recorded in Kesher's suppression list permanently unless the recipient re-subscribes via UNSTOP or START.</div>
  </li>
</ul>
</section>

<section>
<h2>3. Technical Controls</h2>
<ul>
<li><strong>Import certification gate:</strong> Administrators cannot complete a contact import without affirmatively certifying consent.</li>
<li><strong>Opted-out suppression:</strong> Kesher automatically checks every recipient against its suppression list before sending any message. Opted-out numbers are skipped.</li>
<li><strong>STOP keyword processing:</strong> Inbound opt-out replies are processed automatically and in real time.</li>
<li><strong>Mandatory opt-out footer:</strong> "Reply STOP to opt out." is appended to every outbound message and cannot be disabled.</li>
<li><strong>Audit trail:</strong> All import events, certifications, and opt-out records are stored with timestamps and administrator identity.</li>
</ul>
</section>

<section>
<h2>4. Automated Keyword Responses</h2>
<div class="sample-box">
<div class="sample-label">STOP — Opt-Out Confirmation</div>
<div class="sample-text">You have been unsubscribed from [School Name] via Kesher. No further messages will be sent to this number. Reply UNSTOP to re-subscribe.</div>
</div>
<div class="sample-box" style="margin-top:10px;">
<div class="sample-label">HELP — Support Information</div>
<div class="sample-text">[School Name] via Kesher School Comms. For support: help@kesherhq.co or kesherhq.co. Msg &amp; data rates may apply. Reply STOP to opt out.</div>
</div>
<div class="sample-box" style="margin-top:10px;">
<div class="sample-label">UNSTOP / START — Re-Subscribe Confirmation</div>
<div class="sample-text">You have been re-subscribed to [School Name] via Kesher. Messages will resume. Msg &amp; data rates may apply. Reply STOP to opt out at any time.</div>
</div>
</section>

<section>
<h2>5. Consent Record Keeping</h2>
<ul>
<li><strong>School-side records:</strong> The school maintains original consent documentation and must provide these records upon request.</li>
<li><strong>Kesher import records:</strong> Kesher records the import timestamp, administrator identity, and certification acknowledgment for every import event.</li>
<li><strong>Opt-out records:</strong> Kesher retains a permanent suppression list of all opted-out phone numbers. These records are never deleted.</li>
<li><strong>Inbound message logs:</strong> All inbound messages (STOP, HELP, UNSTOP) are recorded with timestamps for compliance audit purposes.</li>
</ul>
</section>

<section>
<h2>6. Prohibited Practices</h2>
<p>The following are explicitly prohibited under Kesher's Terms of Service:</p>
<ul>
<li>Sending SMS messages to recipients who have not explicitly consented</li>
<li>Importing phone numbers sourced from purchased lists, web scraping, or non-consented sources</li>
<li>Re-messaging recipients who have opted out</li>
<li>Sending unsolicited commercial messages, spam, or off-topic marketing content</li>
<li>Misrepresenting the sender identity or message content</li>
</ul>
</section>

<section>
<h2>7. Compliance References</h2>
<ul>
<li>CTIA Messaging Principles and Best Practices (current edition)</li>
<li>The Campaign Registry (TCR) A2P 10DLC requirements</li>
<li>Telephone Consumer Protection Act (TCPA), 47 U.S.C. § 227</li>
<li>CAN-SPAM Act of 2003</li>
<li>Family Educational Rights and Privacy Act (FERPA)</li>
</ul>
</section>

<section>
<h2>8. Related Documents</h2>
<ul>
<li>Privacy Policy — <a href="https://www.kesherhq.co/privacy">kesherhq.co/privacy</a></li>
<li>SMS Terms &amp; Conditions — <a href="https://www.kesherhq.co/sms-terms">kesherhq.co/sms-terms</a></li>
<li>Terms of Service — <a href="https://www.kesherhq.co/terms">kesherhq.co/terms</a></li>
<li>Call-to-Action Documentation — <a href="https://www.kesherhq.co/cta">kesherhq.co/cta</a></li>
</ul>
</section>

<section>
<h2>9. Contact</h2>
<address>
<p><strong>Kesher</strong></p>
<p>Email: <a href="mailto:help@kesherhq.co">help@kesherhq.co</a></p>
<p>Website: <a href="https://www.kesherhq.co">https://www.kesherhq.co</a></p>
</address>
</section>
"""

# ─────────────────────────────────────────────────────────────────────────────
# PDF Generation
# ─────────────────────────────────────────────────────────────────────────────

DOCUMENTS = [
    ("Privacy Policy",              PRIVACY_BODY),
    ("SMS Terms & Conditions",      SMS_TERMS_BODY),
    ("Terms of Service",            TERMS_BODY),
    ("Call-to-Action Documentation",CTA_BODY),
    ("SMS Opt-In Documentation",    OPT_IN_BODY),
]

def generate_pdf(title, body_html):
    html = make_html(title, body_html)
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", encoding="utf-8", delete=False) as f:
        f.write(html)
        tmp_path = f.name

    # Safe filename
    safe_name = title.replace("&", "and").replace("/", "-")
    output_path = os.path.join(DESKTOP, f"{safe_name}.pdf")

    try:
        result = subprocess.run(
            [
                CHROME,
                "--headless",
                "--disable-gpu",
                "--disable-extensions",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                f"--print-to-pdf={output_path}",
                "--print-to-pdf-no-header",
                "--virtual-time-budget=5000",
                f"file://{tmp_path}",
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0 and not os.path.exists(output_path):
            print(f"  ✗ Chrome stderr: {result.stderr.decode()[:200]}", file=sys.stderr)
            return False
    except subprocess.TimeoutExpired:
        print(f"  ✗ Timeout generating {title}", file=sys.stderr)
        return False
    finally:
        os.unlink(tmp_path)

    size_kb = os.path.getsize(output_path) // 1024 if os.path.exists(output_path) else 0
    print(f"  ✓  {safe_name}.pdf  ({size_kb} KB)  →  {output_path}")
    return True


if __name__ == "__main__":
    print(f"\nGenerating Kesher 10DLC compliance PDFs → {DESKTOP}\n")
    success = 0
    for title, body in DOCUMENTS:
        if generate_pdf(title, body):
            success += 1
        time.sleep(1)  # brief pause between Chrome invocations

    print(f"\n{'─'*60}")
    print(f"  {success}/{len(DOCUMENTS)} PDFs generated successfully.")
    if success == len(DOCUMENTS):
        print("  All documents ready for 10DLC registration.")
    print()
