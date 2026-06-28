export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

type UploadOptions = {
  headers?: Record<string, string>;
  onProgress?: (progress: UploadProgress) => void;
};

export function uploadFormData<T>(
  url: string,
  formData: FormData,
  options: UploadOptions = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);

    Object.entries(options.headers || {}).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      options.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100)
      });
    };

    request.onload = () => {
      let payload: { error?: string } = {};
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        payload = {};
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as T);
        return;
      }

      reject(new Error(payload.error || `Upload failed with ${request.status}`));
    };

    request.onerror = () => {
      reject(new Error("Upload failed. Check your network and try again."));
    };

    request.send(formData);
  });
}
