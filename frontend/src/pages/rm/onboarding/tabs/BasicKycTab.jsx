import { FiCamera } from "react-icons/fi";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { COMPANY_TYPES } from "../../../../config/documentChecklists";

const BasicKycTab = ({
  formData,
  setFormData,
  errors,
  loadingStates,
  onVerify,
  onApplicantPanUpload,
  onCompanyPanUpload,
  setApplicantKyc,
  setShowCamera,
  setCameraTarget,
  documents,
  mainVerified,
  applicantVerified,
}) => {
  return (
    <div className="space-y-8">
      {/* Company */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Company Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.companyType}
              onChange={(e) => setFormData((p) => ({ ...p, companyType: e.target.value }))}
              className="input-field"
            >
              <option value="">Select company type</option>
              {Object.values(COMPANY_TYPES).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.companyType && <p className="text-red-500 text-xs mt-1">{errors.companyType}</p>}
          </div>

          {formData.companyType && formData.companyType !== COMPANY_TYPES.PROPRIETORSHIP && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.companyName}
                onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
                className="input-field"
                placeholder="Enter company name"
              />
              {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Mobile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Mobile <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-2">
              <input
                value={formData.companyMobile}
                onChange={(e) => setFormData((p) => ({ ...p, companyMobile: e.target.value }))}
                className="input-field flex-1"
                maxLength={10}
                placeholder="10-digit mobile"
              />
              <button
                type="button"
                onClick={() => onVerify("companyMobile", formData.companyMobile)}
                disabled={loadingStates["companyMobile"] || mainVerified.mobile}
                className={`btn-${mainVerified.mobile ? "success" : "secondary"} min-w-[110px]`}
              >
                {loadingStates["companyMobile"] ? <LoadingSpinner size="sm" /> : (mainVerified.mobile ? "✓ Verified" : "Verify")}
              </button>
            </div>
            {errors.companyMobile && <p className="text-red-500 text-xs mt-1">{errors.companyMobile}</p>}
          </div>

          {/* Company Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Email</label>
            <div className="flex space-x-2">
              <input
                value={formData.companyEmail}
                onChange={(e) => setFormData((p) => ({ ...p, companyEmail: e.target.value }))}
                className="input-field flex-1"
                placeholder="email"
              />
              <button
                type="button"
                onClick={() => onVerify("companyEmail", formData.companyEmail)}
                disabled={loadingStates["companyEmail"] || mainVerified.email}
                className={`btn-${mainVerified.email ? "success" : "secondary"} min-w-[110px]`}
              >
                {loadingStates["companyEmail"] ? <LoadingSpinner size="sm" /> : (mainVerified.email ? "✓ Verified" : "Verify")}
              </button>
            </div>
            {errors.companyEmail && <p className="text-red-500 text-xs mt-1">{errors.companyEmail}</p>}
          </div>
        </div>

        {/* Company PAN + GST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company PAN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company PAN Upload</label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => onCompanyPanUpload(e.target.files?.[0])}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={() => onVerify("companyPan", formData.companyPan)}
                disabled={loadingStates["companyPan"] || mainVerified.pan}
                className={`btn-${mainVerified.pan ? "success" : "secondary"} min-w-[110px]`}
              >
                {loadingStates["companyPan"] ? <LoadingSpinner size="sm" /> : (mainVerified.pan ? "✓ Verified" : "Verify")}
              </button>
            </div>
            {formData.companyPan && <p className="text-xs text-blue-600 mt-1">PAN: {formData.companyPan}</p>}
          </div>

          {/* GST */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">GST</label>
            <input
              value={formData.companyGst}
              onChange={(e) => setFormData((p) => ({ ...p, companyGst: e.target.value.toUpperCase() }))}
              className="input-field"
              placeholder="Enter GST"
            />
            <button
              type="button"
              onClick={() => onVerify("companyGst", formData.companyGst)}
              disabled={loadingStates["companyGst"] || mainVerified.gst || !formData.companyGst}
              className={`mt-2 btn-${mainVerified.gst ? "success" : "secondary"} w-full`}
            >
              {loadingStates["companyGst"] ? <LoadingSpinner size="sm" /> : (mainVerified.gst ? "✓ Verified" : "Verify GST")}
            </button>
          </div>
        </div>
      </div>

      {/* Applicant */}
      <div className="space-y-6 border-t pt-6">
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Applicant Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applicant Name</label>
            <input
              value={formData.applicantName}
              onChange={(e) => setFormData((p) => ({ ...p, applicantName: e.target.value }))}
              className="input-field"
              placeholder="Applicant name"
            />
            {errors.applicantName && <p className="text-red-500 text-xs mt-1">{errors.applicantName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applicant Mobile</label>
            <div className="flex space-x-2">
  <input
    value={formData.applicantMobile}
    onChange={(e) => setFormData((p) => ({ ...p, applicantMobile: e.target.value }))}
    className="input-field flex-1"
    maxLength={10}
    placeholder="Mobile"
  />
  <button
  type="button"
  onClick={() => onVerify("applicantMobile", formData.applicantMobile)}
  disabled={
    loadingStates["applicantMobile_main"] ||
    applicantVerified.mobile
  }
  className={`btn-${applicantVerified.mobile ? "success" : "secondary"} min-w-[110px]`}
>
  {loadingStates["applicantMobile_main"]
    ? <LoadingSpinner size="sm" />
    : applicantVerified.mobile
      ? "✓ Verified"
      : "Verify"}
</button>

</div>

            {errors.applicantMobile && <p className="text-red-500 text-xs mt-1">{errors.applicantMobile}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applicant Email</label>
            <input
              value={formData.applicantEmail}
              onChange={(e) => setFormData((p) => ({ ...p, applicantEmail: e.target.value }))}
              className="input-field"
              placeholder="Email"
            />
            <button
    type="button"
    onClick={() => onVerify("applicantEmail", formData.applicantEmail)}
    disabled={applicantVerified.email}
    className={`btn-${applicantVerified.email ? "success" : "secondary"}`}
  >
    {applicantVerified.email ? "✓ Verified" : "Verify"}
  </button>
            {errors.applicantEmail && <p className="text-red-500 text-xs mt-1">{errors.applicantEmail}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applicant PAN Upload</label>
            <div className="flex items-center space-x-2">
              <input
  type="file"
  accept="image/*,.pdf"
  disabled={applicantVerified.pan}
  onChange={(e) => onApplicantPanUpload(e.target.files?.[0])}
  className={`input-field flex-1 ${
    applicantVerified.pan ? "opacity-60 cursor-not-allowed" : ""
  }`}
/>

              <button
                type="button"
                onClick={() => {
                  setCameraTarget("applicant-pan");
                  setShowCamera(true);
                }}
                className="btn-secondary flex items-center gap-2"
              >
                <FiCamera /> Capture
              </button>
            </div>

            {/* PAN verify uses same main pan status in backend currently */}
            <button
  type="button"
  onClick={() => onVerify("applicantPan", formData.applicantPan)}
  disabled={
    loadingStates["applicantPan"] ||
    applicantVerified.pan ||
    !formData.applicantPan
  }
  className={`mt-2 btn-${applicantVerified.pan ? "success" : "secondary"} w-full`}
>
  {applicantVerified.pan ? "✓ PAN Verified" : "Verify PAN"}
</button>



            {formData.applicantPan && <p className="text-xs text-blue-600 mt-1">PAN: {formData.applicantPan}</p>}
            {errors.applicantPan && <p className="text-red-500 text-xs mt-1">{errors.applicantPan}</p>}
          </div>
        </div>

        {/* Live Photo optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Live Photo (Optional)</label>
          <button
            type="button"
            onClick={() => {
              setCameraTarget("live-photo");
              setShowCamera(true);
            }}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <FiCamera /> Take Live Photo
          </button>
          {documents?.some((d) => d.documentType === "live_photo") && (
            <p className="text-xs text-green-600 mt-1">✓ Photo Captured</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BasicKycTab;
