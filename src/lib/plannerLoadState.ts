type PlannerErrorStateInput = {
  loadedOnce: boolean;
  loadError: string;
  operationError: string;
};

export const classifyPlannerErrors = ({
  loadedOnce,
  loadError,
  operationError,
}: PlannerErrorStateInput) => ({
  initialLoadError: loadedOnce ? "" : loadError,
  backgroundOrOperationError: loadedOnce ? loadError || operationError : "",
});
