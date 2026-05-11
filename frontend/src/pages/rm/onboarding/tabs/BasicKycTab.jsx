import { FiCamera } from "react-icons/fi";
import { useState } from "react";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import kycService from "../../../../services/kycService";
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
  applicantKyc,
  customerId,
  applicantStatus,
  onLoadVerificationStatuses,
  onManualAadhaarUpload,
}) => {
  const [isRefreshingAadhaar, setIsRefreshingAadhaar] = useState(false);
  const [aadhaarRefreshStatus, setAadhaarRefreshStatus] = useState({});

  const handleAadhaarRefresh = async () => {
    if (!customerId) return;
    setIsRefreshingAadhaar(true);
    try {
      // Call parent to reload verification statuses from backend
      if (onLoadVerificationStatuses) {
        await onLoadVerificationStatuses(customerId);
      }
    } catch (error) {
      console.error("Failed to refresh Aadhaar status:", error);
    } finally {
      setIsRefreshingAadhaar(false);
    }
  };
  return (
    <div className="space-y-8">
      {/* Company */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2">
          Company Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.companyType}
              onChange={(e) =>
                setFormData((p) => ({ ...p, companyType: e.target.value }))
              }
              className="input-field"
            >
              <option value="">Select company type</option>
              {Object.values(COMPANY_TYPES).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.companyType && (
              <p className="text-red-500 text-xs mt-1">{errors.companyType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              value={formData.companyName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, companyName: e.target.value }))
              }
              className="input-field"
              placeholder="Enter company name"
              disabled={mainVerified.pan || mainVerified.gst} // assuming name is verified via PAN/GST
            />
            {errors.companyName && (
              <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
            )}
          </div>
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
                onChange={(e) =>
                  setFormData((p) => ({ ...p, companyMobile: e.target.value }))
                }
                className="input-field flex-1"
                maxLength={10}
                placeholder="10-digit mobile"
                disabled={mainVerified.mobile}
              />
              <button
                type="button"
                onClick={() =>
                  onVerify("companyMobile", formData.companyMobile)
                }
                disabled={
                  loadingStates["companyMobile_main"] || mainVerified.mobile
                }
                className={`btn-${mainVerified.mobile ? "success" : "secondary"} min-w-[110px]`}
              >
                {loadingStates["companyMobile_main"] ? (
                  <LoadingSpinner size="sm" />
                ) : mainVerified.mobile ? (
                  "✓ Verified"
                ) : (
                  "Register"
                )}
              </button>
            </div>
            {errors.companyMobile && (
              <p className="text-red-500 text-xs mt-1">
                {errors.companyMobile}
              </p>
            )}
          </div>

          {/* Company Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Email
            </label>
            <div className="flex space-x-2">
              <input
                value={formData.companyEmail}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, companyEmail: e.target.value }))
                }
                className="input-field flex-1"
                placeholder="email"
                disabled={mainVerified.email}
              />
              <button
                type="button"
                onClick={() => onVerify("companyEmail", formData.companyEmail)}
                disabled={
                  loadingStates["companyEmail_main"] || mainVerified.email
                }
                className={`btn-${mainVerified.email ? "success" : "secondary"} min-w-[110px]`}
              >
                {loadingStates["companyEmail_main"] ? (
                  <LoadingSpinner size="sm" />
                ) : mainVerified.email ? (
                  "✓ Verified"
                ) : (
                  "Register"
                )}
              </button>
            </div>
            {errors.companyEmail && (
              <p className="text-red-500 text-xs mt-1">{errors.companyEmail}</p>
            )}
          </div>
        </div>

        {/* Company PAN + GST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company PAN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company PAN Upload
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => onCompanyPanUpload(e.target.files?.[0])}
                disabled={mainVerified.pan}
                className={`input-field flex-1 ${mainVerified.pan ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <span className="text-sm truncate max-w-[150px] text-gray-600">
                {applicantKyc?.companyPanFile?.name || "No file"}
              </span>
              {applicantKyc?.companyPanFile && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const url = URL.createObjectURL(
                        applicantKyc.companyPanFile,
                      );
                      window.open(url, "_blank");
                    } catch (e) {
                      console.error("Preview failed", e);
                    }
                  }}
                  className="ml-2 text-xs text-primary-600 hover:underline"
                >
                  Preview
                </button>
              )}
            </div>

            <div className="mt-2">
              <input
                value={formData.companyPan || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    companyPan: e.target.value.toUpperCase(),
                  }))
                }
                className="input-field"
                placeholder="Enter Company PAN"
                disabled={mainVerified.pan}
              />
            </div>

            <button
              type="button"
              onClick={() => onVerify("companyPan", formData.companyPan)}
              disabled={
                loadingStates["companyPan_main"] ||
                mainVerified.pan ||
                !formData.companyPan
              }
              className={`mt-2 btn-${mainVerified.pan ? "success" : "secondary"} w-full`}
            >
              {loadingStates["companyPan_main"] ? (
                <LoadingSpinner size="sm" />
              ) : mainVerified.pan ? (
                "✓ PAN Verified"
              ) : (
                "Verify PAN"
              )}
            </button>
          </div>

          {/* GST */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GST
            </label>
            <input
              value={formData.companyGst}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  companyGst: e.target.value.toUpperCase(),
                }))
              }
              placeholder="Enter GST"
              disabled={mainVerified.gst}
              className="input-field"
            />
            <button
              type="button"
              onClick={() => onVerify("companyGst", formData.companyGst)}
              disabled={
                loadingStates["companyGst_main"] ||
                mainVerified.gst ||
                !formData.companyGst
              }
              className={`mt-2 btn-${mainVerified.gst ? "success" : "secondary"} w-full`}
            >
              {loadingStates["companyGst_main"] ? (
                <LoadingSpinner size="sm" />
              ) : mainVerified.gst ? (
                "✓ Verified"
              ) : (
                "Verify GST"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Applicant */}
      <div className="space-y-6 border-t pt-6">
        {/* <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Applicant (Same as Company Details)</h3> */}
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2">
          Applicant{" "}
          <span className="text-blue-500">(Same as Company Details)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant Name
            </label>
            <input
              value={formData.applicantName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, applicantName: e.target.value }))
              }
              className="input-field"
              placeholder="Applicant name"
              disabled={applicantVerified.pan}
            />
            {errors.applicantName && (
              <p className="text-red-500 text-xs mt-1">
                {errors.applicantName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant Mobile
            </label>
            <div className="flex space-x-2">
              <input
                value={formData.applicantMobile}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    applicantMobile: e.target.value,
                  }))
                }
                className="input-field flex-1"
                maxLength={10}
                placeholder="Mobile"
                disabled={applicantVerified.mobile}
              />
              <button
                type="button"
                onClick={() =>
                  onVerify("applicantMobile", formData.applicantMobile)
                }
                disabled={
                  loadingStates["applicantMobile_main"] ||
                  applicantVerified.mobile
                }
                className={`btn-${applicantVerified.mobile ? "success" : "secondary"} min-w-[110px]`}
              >
                {loadingStates["applicantMobile_main"] ? (
                  <LoadingSpinner size="sm" />
                ) : applicantVerified.mobile ? (
                  "✓ Verified"
                ) : (
                  "Register"
                )}
              </button>
            </div>

            {errors.applicantMobile && (
              <p className="text-red-500 text-xs mt-1">
                {errors.applicantMobile}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant Email
            </label>
            <input
              value={formData.applicantEmail}
              onChange={(e) =>
                setFormData((p) => ({ ...p, applicantEmail: e.target.value }))
              }
              className="input-field"
              placeholder="Email"
              disabled={applicantVerified.email}
            />
            <button
              type="button"
              onClick={() =>
                onVerify("applicantEmail", formData.applicantEmail)
              }
              disabled={
                loadingStates["applicantEmail_main"] || applicantVerified.email
              }
              className={`btn-${applicantVerified.email ? "success" : "secondary"} min-w-[110px]`}
            >
              {loadingStates["applicantEmail_main"] ? (
                <LoadingSpinner size="sm" />
              ) : applicantVerified.email ? (
                "✓ Verified"
              ) : (
                "Register"
              )}
            </button>

            {errors.applicantEmail && (
              <p className="text-red-500 text-xs mt-1">
                {errors.applicantEmail}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant PAN Upload
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={applicantVerified.pan}
                onChange={(e) => onApplicantPanUpload(e.target.files?.[0])}
                className={`input-field flex-1 ${applicantVerified.pan ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <span className="text-sm truncate max-w-[150px]">
                {applicantKyc?.panFile?.name || "No file"}
              </span>

              {applicantKyc?.panFile && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const url = URL.createObjectURL(applicantKyc.panFile);
                      window.open(url, "_blank");
                    } catch (e) {
                      console.error("Preview failed", e);
                    }
                  }}
                  className="ml-2 text-xs text-primary-600 hover:underline"
                >
                  Preview
                </button>
              )}

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
                loadingStates["applicantPan_main"] ||
                applicantVerified.pan ||
                !formData.applicantPan
              }
              className={`mt-2 btn-${applicantVerified.pan ? "success" : "secondary"} w-full flex items-center justify-center`}
            >
              {applicantVerified.pan ? (
                "✓ PAN Verified"
              ) : loadingStates["applicantPan_main"] ? (
                <LoadingSpinner size="sm" />
              ) : (
                "Verify PAN"
              )}
            </button>

            <div className="mt-2">
              <input
                value={formData.applicantPan || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    applicantPan: e.target.value.toUpperCase(),
                  }))
                }
                className="input-field"
                placeholder="Enter Applicant PAN"
                disabled={applicantVerified.pan}
              />
            </div>
            {errors.applicantPan && (
              <p className="text-red-500 text-xs mt-1">{errors.applicantPan}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          
          {/* Applicant Aadhaar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant Aadhaar Number <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              required
              value={formData.applicantAadhaarNumber || ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  applicantAadhaarNumber: e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 12),
                }))
              }
              className="input-field"
              placeholder="Enter Aadhaar Number"
              maxLength={12}
            />

            {errors.applicantAadhaarNumber && (
              <p className="text-red-500 text-xs mt-1">
                {errors.applicantAadhaarNumber}
              </p>
            )}
          </div>

          {/* Applicant Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant Aadhaar Address <span className="text-red-500">*</span>
            </label>

            <textarea
              value={formData.applicantAadhaarAddress || ""}
              required
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  applicantAadhaarAddress: e.target.value,
                }))
              }
              className="input-field min-h-[100px]"
              placeholder="Enter Applicant Aadhaar Address"
            />

            {errors.applicantAadhaarAddress && (
              <p className="text-red-500 text-xs mt-1">
                {errors.applicantAadhaarAddress}
              </p>
            )}
          </div>
        </div>

        {/* Applicant Aadhaar KYC (shown after PAN verified) */}
        {applicantVerified.pan && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicant Aadhaar KYC
            </label>

            {/* Show info message if Aadhaar is initiated but not verified */}
            {applicantStatus?.aadhaarStatus === "INITIATED" && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                ℹ️ KYC link sent to your mobile. Complete Aadhaar verification
                and click "Refresh Status" to update.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
<button
                  type="button"
                  onClick={() => onVerify("applicantAadhaar", formData.applicantAadhaarNumber)}
                  disabled={
                    loadingStates["applicantAadhaar_main"] ||
                    !applicantVerified.pan ||
                    applicantStatus?.aadhaarStatus === "VERIFIED"
                  }
                  className={`btn-${applicantStatus?.aadhaarStatus === "VERIFIED" ? "success" : "secondary"} w-full flex items-center justify-center`}
                >
                  {applicantStatus?.aadhaarStatus === "VERIFIED"
                    ? "✓ Aadhaar Verified"
                    : applicantStatus?.aadhaarStatus === "INITIATED"
                      ? "Resend Aadhaar KYC 🔁"
                      : "Verify Aadhaar"}
                </button>

                {/* Show Refresh Status button if Aadhaar is initiated but not verified */}
                {applicantStatus?.aadhaarStatus === "INITIATED" && (
                  <button
                    type="button"
                    onClick={handleAadhaarRefresh}
                    disabled={isRefreshingAadhaar}
                    className="mt-2 btn-secondary w-full flex items-center justify-center"
                  >
                    {isRefreshingAadhaar ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      "Refresh Status"
                    )}
                  </button>
                )}
              </div>

              {/* Manual Aadhaar Upload Option */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Upload Manual Aadhaar Card
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onManualAadhaarUpload) {
                      onManualAadhaarUpload(file);
                    }
                  }}
                  className="input-field w-full"
                  disabled={applicantStatus?.aadhaarStatus === "VERIFIED"}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload Aadhaar card (PDF/Image)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Photo optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Photo (Optional)
          </label>
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
