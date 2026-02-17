// import { FiX } from 'react-icons/fi'

// const AddressForm = ({
//     index,
//     data = {},
//     onChange,
//     onRemove,
//     errors = {}
// }) => {
//     const addressTypes = ['Residence', 'Shop', 'Godown', 'Rented', 'Owned']

//     return (
//         <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">
//             <button
//                 type="button"
//                 onClick={() => onRemove(index)}
//                 className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
//                 title="Remove Address"
//             >
//                 <FiX className="h-5 w-5" />
//             </button>

//             <h4 className="text-lg font-semibold text-gray-900 mb-4">
//                 Address Details {index + 1}
//             </h4>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {/* Address Type */}
//                 <div className="md:col-span-2">
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Address Type <span className="text-red-500">*</span>
//                     </label>
//                     <select
//                         value={data.type || ''}
//                         onChange={(e) => onChange(index, { ...data, type: e.target.value })}
//                         className="input-field"
//                     >
//                         <option value="">Select address type</option>
//                         {addressTypes.map((type) => (
//                             <option key={type} value={type}>{type}</option>
//                         ))}
//                     </select>
//                     {errors.type && (
//                         <p className="text-red-500 text-xs mt-1">{errors.type}</p>
//                     )}
//                 </div>

//                 {/* Conditional Fields based on selection */}
//                 {data.type && (
//                     <>
//                         <div className="md:col-span-2">
//                             <label className="block text-sm font-medium text-gray-700 mb-2">
//                                 Full Address <span className="text-red-500">*</span>
//                             </label>
//                             <textarea
//                                 value={data.fullAddress || ''}
//                                 onChange={(e) => onChange(index, { ...data, fullAddress: e.target.value })}
//                                 className="input-field min-h-[80px]"
//                                 placeholder="Enter complete address details"
//                             />
//                             {errors.fullAddress && (
//                                 <p className="text-red-500 text-xs mt-1">{errors.fullAddress}</p>
//                             )}
//                         </div>

//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-2">
//                                 Pincode <span className="text-red-500">*</span>
//                             </label>
//                             <input
//                                 type="text"
//                                 value={data.pincode || ''}
//                                 onChange={(e) => onChange(index, { ...data, pincode: e.target.value })}
//                                 className="input-field"
//                                 placeholder="6-digit pincode"
//                                 maxLength={6}
//                             />
//                             {errors.pincode && (
//                                 <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>
//                             )}
//                         </div>

//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-2">
//                                 State <span className="text-red-500">*</span>
//                             </label>
//                             <input
//                                 type="text"
//                                 value={data.state || ''}
//                                 onChange={(e) => onChange(index, { ...data, state: e.target.value })}
//                                 className="input-field"
//                                 placeholder="Enter state"
//                             />
//                             {errors.state && (
//                                 <p className="text-red-500 text-xs mt-1">{errors.state}</p>
//                             )}
//                         </div>

//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-2">
//                                 City <span className="text-red-500">*</span>
//                             </label>
//                             <input
//                                 type="text"
//                                 value={data.city || ''}
//                                 onChange={(e) => onChange(index, { ...data, city: e.target.value })}
//                                 className="input-field"
//                                 placeholder="Enter city"
//                             />
//                             {errors.city && (
//                                 <p className="text-red-500 text-xs mt-1">{errors.city}</p>
//                             )}
//                         </div>
//                     </>
//                 )}
//             </div>
//         </div>
//     )
// }

// export default AddressForm


import { useMemo } from 'react'
import { FiX } from 'react-icons/fi'

const AddressForm = ({
  index,              // Only for display
  data = {},
  onChange,
  onRemove,
  errors = {},
  readOnly = false
}) => {
  const addressTypes = ['Residence', 'Shop', 'Godown', 'Rented', 'Owned']

  // Stable identity (DO NOT use index)
  const stableKey = useMemo(() => data?.id || data?.localKey, [
    data?.id,
    data?.localKey
  ])

  const handleChange = (patch) => {
    if (readOnly) return
    onChange?.(stableKey, { ...data, ...patch })
  }

  const handlePincodeChange = (value) => {
    // Allow only digits and max 6 length
    const clean = value.replace(/\D/g, '').slice(0, 6)
    handleChange({ pincode: clean })
  }

  return (
    <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">

      {!readOnly && (
        <button
          type="button"
          onClick={() => onRemove?.(stableKey)}
          className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
          title="Remove Address"
        >
          <FiX className="h-5 w-5" />
        </button>
      )}

      <h4 className="text-lg font-semibold text-gray-900 mb-4">
        Address Details {typeof index === 'number' ? index + 1 : ''}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Address Type */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address Type <span className="text-red-500">*</span>
          </label>

          <select
            value={data.type || ''}
            onChange={(e) => handleChange({ type: e.target.value })}
            className="input-field"
            disabled={readOnly}
          >
            <option value="">Select address type</option>
            {addressTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {errors.type && (
            <p className="text-red-500 text-xs mt-1">{errors.type}</p>
          )}
        </div>

        {/* Conditional Fields */}
        {data.type && (
          <>
            {/* Full Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Address <span className="text-red-500">*</span>
              </label>

              <textarea
                value={data.fullAddress || ''}
                onChange={(e) =>
                  handleChange({
                    fullAddress: e.target.value.slice(0, 500)
                  })
                }
                className="input-field min-h-[80px]"
                placeholder="Enter complete address details"
                disabled={readOnly}
              />

              {errors.fullAddress && (
                <p className="text-red-500 text-xs mt-1">{errors.fullAddress}</p>
              )}
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pincode <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={data.pincode || ''}
                onChange={(e) => handlePincodeChange(e.target.value)}
                className="input-field"
                placeholder="6-digit pincode"
                maxLength={6}
                disabled={readOnly}
              />

              {errors.pincode && (
                <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>
              )}
            </div>

            {/* State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={data.state || ''}
                onChange={(e) =>
                  handleChange({ state: e.target.value.slice(0, 100) })
                }
                className="input-field"
                placeholder="Enter state"
                disabled={readOnly}
              />

              {errors.state && (
                <p className="text-red-500 text-xs mt-1">{errors.state}</p>
              )}
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={data.city || ''}
                onChange={(e) =>
                  handleChange({ city: e.target.value.slice(0, 100) })
                }
                className="input-field"
                placeholder="Enter city"
                disabled={readOnly}
              />

              {errors.city && (
                <p className="text-red-500 text-xs mt-1">{errors.city}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AddressForm
