/**
 * Parses backend error responses to extract readable error messages.
 * Handles the standard format: { status_code, message, data: { field: [errors] } }
 */
export const parseBackendError = (error) => {
    if (error.response && error.response.data) {
        const { message, data } = error.response.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const fieldErrors = Object.entries(data).map(([field, errors]) => {
                const errorText = Array.isArray(errors) ? errors.join(', ') : errors;
                return `${field}: ${errorText}`;
            });
            if (fieldErrors.length > 0) {
                return `Validation Error: ${fieldErrors.join(' | ')}`;
            }
        }
        if (message) return message;
    }
    return error.message || "An unexpected error occurred. Please try again.";
};
