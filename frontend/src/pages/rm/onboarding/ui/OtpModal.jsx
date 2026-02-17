import LoadingSpinner from "../../../../components/LoadingSpinner";

const OtpModal = ({ open, otpValue, setOtpValue, otpData, isVerifying, onCancel, onVerify }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          Verify {otpData.type === "mobile" ? "Mobile" : "Email"}
        </h2>

        <p className="text-sm text-gray-500">
          Enter OTP sent to <b>{otpData.value}</b>
        </p>

        <input
          type="text"
          value={otpValue}
          onChange={(e) => setOtpValue(e.target.value)}
          className="input-field text-center text-2xl tracking-widest"
          placeholder="0000"
          maxLength={6}
        />

        <div className="flex space-x-3 mt-6">
          <button onClick={onCancel} className="flex-1 btn-secondary">
            Cancel
          </button>
          <button onClick={onVerify} disabled={isVerifying} className="flex-1 btn-primary">
            {isVerifying ? <LoadingSpinner size="sm" /> : "Verify OTP"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OtpModal;
