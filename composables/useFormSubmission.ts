/**
 * Single-submit guard for forms.
 *
 * Wrap the async part of a submit handler:
 *
 *   const { isSubmitting, submit } = useFormSubmission();
 *   const kirim = () => submit(async () => { ... });
 *
 * and bind `isSubmitting` to the button:
 *
 *   <button type="submit" :disabled="isSubmitting">…</button>
 *
 * While the task runs the ref stays `true`, so the button is disabled and any
 * extra click/Enter is ignored (the second call returns immediately). The lock
 * is released in `finally`, so a failed request never leaves the form stuck.
 */
export const useFormSubmission = () => {
  const isSubmitting = ref(false);

  const submit = async <T>(task: () => T | Promise<T>): Promise<T | undefined> => {
    if (isSubmitting.value) return;

    isSubmitting.value = true;
    try {
      return await task();
    } finally {
      isSubmitting.value = false;
    }
  };

  return { isSubmitting, submit };
};
