import { XMLParser } from 'fast-xml-parser';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

/**
 * PURE UTILITY
 * JSON → HTML → PDF
 */
export async function generateBureauPdf(
  bureauXml: string,
  outputFileName: string,
): Promise<{ filePath: string; fileSize: number }> {
  const uploadDir = path.join(process.cwd(), 'uploads/bureau');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  // ✅ THIS WAS MISSING
  const parsed = parser.parse(bureauXml);

  const filePath = path.join(uploadDir, outputFileName);

  const html = renderHtmlFromBureauJson(parsed);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  const stats = fs.statSync(filePath);

  return {
    filePath: `uploads/bureau/${outputFileName}`,
    fileSize: stats.size,
  };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function S(v: any) {
  return v !== undefined && v !== null && v !== '' ? String(v) : '-';
}

function fmtDate(d: any) {
  if (!d) return '-';
  const s = String(d).trim();
  return /^\d{8}$/.test(s)
    ? `${s.slice(6, 8)}-${s.slice(4, 6)}-${s.slice(0, 4)}`
    : s;
}

/* ---------------- HTML rendering ---------------- */

export function renderHtmlFromBureauJson(data: any): string {
  const r = data?.INProfileResponse ?? {};
  const hdr = r?.CreditProfileHeader ?? {};
  const score = r?.SCORE ?? {};

  const cur = r?.Current_Application?.Current_Application_Details ?? {};
  const appl = cur?.Current_Applicant_Details ?? {};
  const addr = cur?.Current_Applicant_Address_Details ?? {};

  const cais = r?.CAIS_Account ?? {};
  const caisSummary = cais?.CAIS_Summary ?? {};
  const caisAccounts = asArray(cais?.CAIS_Account_DETAILS);

  const caps = r?.CAPS ?? {};
  const capsSummary = caps?.CAPS_Summary ?? {};
  const capsDetails = asArray(caps?.CAPS_Application_Details);

  const nonCreditCaps = r?.NonCreditCAPS?.NonCreditCAPS_Summary ?? {};
  const totalCaps = r?.TotalCAPS_Summary ?? {};

  const name = [
    appl.First_Name,
    appl.Middle_Name1,
    appl.Last_Name,
  ].filter(Boolean).join(' ');

  const address = [
    addr.FlatNoPlotNoHouseNo,
    addr.BldgNoSocietyName,
    addr.RoadNoNameAreaLocality,
    addr.City,
    addr.State,
    addr.PINCode,
  ].filter(Boolean).join(', ');

  /* ---------------- CAIS Accounts ---------------- */

  const caisBlocks = caisAccounts.map((acc: any, i: number) => {
    const history = asArray(acc.CAIS_Account_History);

    const historyRows = history.map((h: any) => `
      <tr>
        <td>${S(h.Year)}</td>
        <td>${S(h.Month)}</td>
        <td>${S(h.Days_Past_Due)}</td>
        <td>${S(h.Asset_Classification)}</td>
      </tr>
    `).join('');

    return `
      <div class="acc-block">
        <h4>Account ${i + 1} – ${S(acc.Account_Number)}</h4>

        <div class="grid">
          <div>Subscriber</div><div>${S(acc.Subscriber_Name)}</div>
          <div>Account Type</div><div>${S(acc.Account_Type)}</div>
          <div>Status</div><div>${S(acc.Account_Status)}</div>
          <div>Open Date</div><div>${fmtDate(acc.Open_Date)}</div>
          <div>Highest Credit</div><div>${S(acc.Highest_Credit_or_Original_Loan_Amount)}</div>
          <div>Current Balance</div><div>${S(acc.Current_Balance)}</div>
          <div>Amount Past Due</div><div>${S(acc.Amount_Past_Due)}</div>
          <div>Date Reported</div><div>${fmtDate(acc.Date_Reported)}</div>
        </div>

        <h5>DPD History</h5>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Month</th>
              <th>DPD</th>
              <th>Asset Class</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows || `<tr><td colspan="4">No history</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }).join('<hr/>');

  /* ---------------- CAPS ---------------- */

  const capsRows = capsDetails.map((c: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${S(c.Subscriber_Name)}</td>
      <td>${fmtDate(c.Date_of_Request)}</td>
      <td>${S(c.Amount_Financed)}</td>
      <td>${S(c.Duration_Of_Agreement)}</td>
      <td>${S(c.Enquiry_Reason)}</td>
    </tr>
  `).join('');

  /* ---------------- FINAL HTML ---------------- */

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial; font-size: 12px; margin: 24px; }
  h2 { border-bottom: 2px solid #000; padding-bottom: 6px; }
  h3 { border-bottom: 1px solid #999; padding-bottom: 4px; }
  h4 { margin: 8px 0; }
  .grid {
    display: grid;
    grid-template-columns: 160px 1fr 160px 1fr;
    gap: 6px 12px;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #bbb; padding: 4px; font-size: 11px; }
  th { background: #eee; }
  .box { border: 1px solid #bbb; padding: 10px; margin-bottom: 14px; }
  .acc-block { margin-bottom: 14px; }
</style>
</head>

<body>

<h2>Experian Credit Report</h2>

<div class="box">
  <h3>Applicant Details</h3>
  <div class="grid">
    <div>Name</div><div>${S(name)}</div>
    <div>DOB</div><div>${fmtDate(appl.Date_Of_Birth_Applicant)}</div>
    <div>PAN</div><div>${S(appl.IncomeTaxPan)}</div>
    <div>Mobile</div><div>${S(appl.Telephone_Number_Applicant_1st)}</div>
    <div>Address</div><div style="grid-column: span 3">${S(address)}</div>
  </div>
</div>

<div class="box">
  <h3>Score</h3>
  <p><b>Bureau Score:</b> ${S(score.BureauScore)}</p>
</div>

<div class="box">
  <h3>CAIS Summary</h3>
  <div class="grid">
    <div>Total Accounts</div><div>${S(caisSummary.CreditAccountTotal)}</div>
    <div>Active</div><div>${S(caisSummary.CreditAccountActive)}</div>
    <div>Closed</div><div>${S(caisSummary.CreditAccountClosed)}</div>
    <div>Defaults</div><div>${S(caisSummary.CreditAccountDefault)}</div>
  </div>
</div>

<div class="box">
  <h3>Account Details</h3>
  ${caisBlocks || '<p>No account data</p>'}
</div>

<div class="box">
  <h3>CAPS Enquiries</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Subscriber</th>
        <th>Date</th>
        <th>Amount</th>
        <th>Tenure</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      ${capsRows || '<tr><td colspan="6">No enquiries</td></tr>'}
    </tbody>
  </table>
</div>

<div class="box">
  <h3>Total CAPS Summary</h3>
  <div class="grid">
    <div>Last 7 Days</div><div>${S(totalCaps.TotalCAPSLast7Days)}</div>
    <div>Last 30 Days</div><div>${S(totalCaps.TotalCAPSLast30Days)}</div>
    <div>Last 90 Days</div><div>${S(totalCaps.TotalCAPSLast90Days)}</div>
    <div>Last 180 Days</div><div>${S(totalCaps.TotalCAPSLast180Days)}</div>
  </div>
</div>

<div class="box">
  <h3>Non-Credit CAPS Summary</h3>
  <div class="grid">
    <div>Last 7 Days</div><div>${S(nonCreditCaps.NonCreditCAPSLast7Days)}</div>
    <div>Last 30 Days</div><div>${S(nonCreditCaps.NonCreditCAPSLast30Days)}</div>
    <div>Last 90 Days</div><div>${S(nonCreditCaps.NonCreditCAPSLast90Days)}</div>
    <div>Last 180 Days</div><div>${S(nonCreditCaps.NonCreditCAPSLast180Days)}</div>
  </div>
</div>

<p style="font-size:10px;color:#666;margin-top:20px">
  Generated automatically
</p>

</body>
</html>
`;
}
