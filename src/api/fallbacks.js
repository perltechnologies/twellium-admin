export const isNotFoundError = (error) => error?.response?.status === 404;

export const withEndpointFallbacks = async (primaryRequest, fallbackRequests = []) => {
    try {
        return await primaryRequest();
    } catch (error) {
        if (!isNotFoundError(error) || fallbackRequests.length === 0) {
            throw error;
        }

        let lastError = error;
        for (const fallbackRequest of fallbackRequests) {
            try {
                return await fallbackRequest();
            } catch (fallbackError) {
                if (!isNotFoundError(fallbackError)) {
                    throw fallbackError;
                }
                lastError = fallbackError;
            }
        }

        throw lastError;
    }
};
