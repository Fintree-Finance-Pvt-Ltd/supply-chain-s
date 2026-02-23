import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as he from 'he';
import { BureauResult } from './bureau.types';

export class BureauService {
  private experianUrl = process.env.EXPERIAN_URL!;
  private experianUser = process.env.EXPERIAN_USER!;
  private experianPassword = process.env.EXPERIAN_PASSWORD!;

  constructor() {
    if (!this.experianUrl || !this.experianUser || !this.experianPassword) {
      console.warn('[BureauService] Warning: Missing Experian config in .env — bureau checks will be unavailable');
    }
  }

  // ---------------------------------------------------
  // Helpers
  // ---------------------------------------------------
  private formatDob(dob: any): string {
    if (!dob) return '';
    if (dob instanceof Date) {
      return `${dob.getFullYear()}${String(dob.getMonth() + 1).padStart(2, '0')}${String(
        dob.getDate(),
      ).padStart(2, '0')}`;
    }
    return String(dob).replace(/-/g, '').slice(0, 8);
  }

  private toUpper(val?: string): string {
    return val ? String(val).trim().toUpperCase() : '';
  }

  // ---------------------------------------------------
  // 🏦 Run Experian Bureau
  // ---------------------------------------------------
  async runBureau(data: any): Promise<BureauResult> {
    console.log('🚀 Experian runBureau called');
    try {
      const dobFormatted = this.formatDob(data.dob);
      const genderCode = this.toUpper(data.gender) === 'F' ? 2 : 1;

      const STATE_CODES: Record<string, string> = {
        'JAMMU and KASHMIR': '01',
        'HIMACHAL PRADESH': '02',
        PUNJAB: '03',
        CHANDIGARH: '04',
        UTTRANCHAL: '05',
        HARAYANA: '06',
        DELHI: '07',
        RAJASTHAN: '08',
        'UTTAR PRADESH': '09',
        BIHAR: '10',
        SIKKIM: '11',
        'ARUNACHAL PRADESH': '12',
        NAGALAND: '13',
        MANIPUR: '14',
        MIZORAM: '15',
        TRIPURA: '16',
        MEGHALAYA: '17',
        ASSAM: '18',
        'WEST BENGAL': '19',
        JHARKHAND: '20',
        ORRISA: '21',
        CHHATTISGARH: '22',
        'MADHYA PRADESH': '23',
        GUJRAT: '24',
        'DAMAN and DIU': '25',
        'DADARA and NAGAR HAVELI': '26',
        MAHARASHTRA: '27',
        'ANDHRA PRADESH': '28',
        KARNATAKA: '29',
        GOA: '30',
        LAKSHADWEEP: '31',
        KERALA: '32',
        'TAMIL NADU': '33',
        PONDICHERRY: '34',
        'ANDAMAN and NICOBAR ISLANDS': '35',
        TELANGANA: '36',
      };

      const stateKey = this.toUpper(data.current_state) || 'MAHARASHTRA';
      const stateCode = STATE_CODES[stateKey] ?? '27';

      const firstName = this.toUpper(data.firstName || data.first_name);
      const lastName = this.toUpper(data.lastName || data.last_name);
      const pan = this.toUpper(data.pan_number);
      const city = this.toUpper(data.current_village_city);

      // ---------------------------------------------------
      // SOAP XML (unchanged)
      // ---------------------------------------------------
      const soapBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:cbv2">
<soapenv:Header/>
<soapenv:Body>
<urn:process>
<urn:in>
<INProfileRequest>
<Identification>
<XMLUser>${this.experianUser}</XMLUser>
<XMLPassword>${this.experianPassword}</XMLPassword>
</Identification>
<Application>
<FTReferenceNumber></FTReferenceNumber>
        <CustomerReferenceID></CustomerReferenceID>
<EnquiryReason>13</EnquiryReason>
<FinancePurpose>99</FinancePurpose>
<AmountFinanced>1</AmountFinanced>
<DurationOfAgreement>3</DurationOfAgreement>
<ScoreFlag>1</ScoreFlag>
        <PSVFlag></PSVFlag>
</Application>
<Applicant>
<Surname>${lastName}</Surname>
<FirstName>${firstName}</FirstName>
<MiddleName1></MiddleName1>
        <MiddleName2></MiddleName2>
        <MiddleName3></MiddleName3>
<GenderCode>${genderCode}</GenderCode>
<IncomeTaxPAN>${pan}</IncomeTaxPAN>
<PANIssueDate></PANIssueDate>
        <PANExpirationDate></PANExpirationDate>
        <PassportNumber></PassportNumber>
        <PassportIssueDate></PassportIssueDate>
        <PassportExpirationDate></PassportExpirationDate>
        <VoterIdentityCard></VoterIdentityCard>
        <VoterIDIssueDate></VoterIDIssueDate>
        <VoterIDExpirationDate></VoterIDExpirationDate>
        <DriverLicenseNumber></DriverLicenseNumber>
        <DriverLicenseIssueDate></DriverLicenseIssueDate>
        <DriverLicenseExpirationDate></DriverLicenseExpirationDate>
        <RationCardNumber></RationCardNumber>
        <RationCardIssueDate></RationCardIssueDate>
        <RationCardExpirationDate></RationCardExpirationDate>
        <UniversalIDNumber></UniversalIDNumber>
        <UniversalIDIssueDate></UniversalIDIssueDate>
        <UniversalIDExpirationDate></UniversalIDExpirationDate>
<DateOfBirth>${dobFormatted}</DateOfBirth>
<STDPhoneNumber></STDPhoneNumber>
<PhoneNumber>${data.mobile_number}</PhoneNumber>
<TelephoneExtension></TelephoneExtension>
        <TelephoneType></TelephoneType>
        <MobilePhone></MobilePhone>
        <EMailId></EMailId>
</Applicant>
<Address>
<FlatNoPlotNoHouseNo>${data.current_address}</FlatNoPlotNoHouseNo>
<BldgNoSocietyName></BldgNoSocietyName>
        <RoadNoNameAreaLocality></RoadNoNameAreaLocality>
<City>${city}</City>
<Landmark></Landmark>
<State>${stateCode}</State>
<PinCode>${data.current_pincode}</PinCode>
</Address>
<AdditionalAddressFlag>
        <Flag>N</Flag>
    </AdditionalAddressFlag>
    <AdditionalAddress>
        <FlatNoPlotNoHouseNo></FlatNoPlotNoHouseNo>
        <BldgNoSocietyName></BldgNoSocietyName>
        <RoadNoNameAreaLocality></RoadNoNameAreaLocality>
        <City></City>
        <Landmark></Landmark>
        <State></State>
        <PinCode></PinCode>
    </AdditionalAddress>
</INProfileRequest>
</urn:in>
</urn:process>
</soapenv:Body>
</soapenv:Envelope>`;

      console.log("Experian request", soapBody);


      const { data: xmlResponse } = await axios.post(
        this.experianUrl,
        soapBody,
        {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: 'urn:cbv2/process',
          },
          validateStatus: () => true,
        },
      );

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlResponse);

      const encoded =
        parsed['SOAP-ENV:Envelope']?.['SOAP-ENV:Body']?.[
        'ns2:processResponse'
        ]?.['ns2:out'];

      if (!encoded) {
        return { success: false, score: null, response: xmlResponse };
      }

      const decodedXml = he.decode(encoded);
      const inner = parser.parse(decodedXml);

      const score =
        inner?.INProfileResponse?.SCORE?.BureauScore ?? null;

      return {
        success: !!score,
        score: score ? Number(score) : null,
        requestXml: soapBody,
        response: decodedXml,
        error: score ? null : 'Score not received',
      };
    } catch (err: any) {
      return {
        success: false,
        score: null,
        requestXml: null,
        response: err?.response?.data ?? null,
        error: err.message,
      };
    }
  }
}
