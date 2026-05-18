import React from "react";
  export const MOBILE_OTP_CONSENT = `
    I/We hereby authorise Fintree Finance Private Limited (FFPL) (hereinafter referred to as “Lender”) or its associates/subsidiaries affiliates to obtain, verify, exchange, share or part with all the information or otherwise, regarding my/our office/residence and/or contact me/us or my/our family/ employer/Banker/Credit Bureau/ RBI or any third parties as deemed necessary and/or do any such acts till such period as they deem necessary and/or disclose to Reserve bank of India, Credit Information Companies, Banks/NBFCs, or any other authority and institution, including but not limited to current balance, payment history, default, if any, etc. 
    I/We hereby authorise Lender’s employees/agents to access my/our premises during normal office hours for carrying out any verification investigation which includes taking photographs and post disbursement scrutiny. 
    I/We hereby authorise Lender to approach my/our existing bankers or any other prospective lender for any relevant information for consideration of loan and thereafter. I/We hereby provide my/our consent to receive information/services etc for marketing purpose through telephone/mobile/SMS/Email. 
    I/We hereby authorise Lender to market/sell/promote/endorse any other product or service beneficial to me/us. 
    I/We hereby authorise Lender to purge the documents submitted by me/us, if the case is not disbursed/approved for whatever reason within 3 months of application. 
    I/We hereby provide my/our consent to avail information on products and services of other Companies and authorise to cross sell other company’s product and services. I/We hereby authorise Fintree Finance Private Limited(FFPL) or its associates/subsidiaries/affiliates to obtain, verify, exchange, share or part with all the information or otherwise, regarding my/our office/ residence and/or contact me/us or my our family/ employer/Banker/Credit Bureau/ RBI or any third parties as deemed necessary and/or do any such acts till such period as they deem necessary and/or disclose to Reserve bank of India, Credit Information Companies, Banks/NBFCs, or any other authority and institution, including but not limited to current balance, payment history, default, if any, etc. 
    I/We hereby agree to give my/our express consent to Lender to disclose all the information and data furnished by me/us and/or to receive information from Central KYC Registry/third parties including but not limited to vendors, outsourcing agencies, business correspondents for analysing, processing, report generation, storing, record keeping or to various credit information companies/ credit bureaus e.g. 
    Credit Information Bureaus (India) Limited (CIBIL), or to information utilities under the Insolvency Bankruptcy Code 2016 through physical or SMS or email or any other mode. */}
`;
const MobileConsentModal = ({
  open,
  onClose,
  onAccept,
}) => {
  if (!open) return null;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[450px]">
        <h2 className="text-xl font-semibold mb-4">
          Consent for Mobile Verification
        </h2>

        <div className="text-sm text-gray-700 space-y-3 max-h-[300px] overflow-y-auto">
          <p>
            {MOBILE_OTP_CONSENT}
            
          </p>

        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Cancel
          </button>

          <button
            onClick={onAccept}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileConsentModal;