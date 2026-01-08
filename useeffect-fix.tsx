  // Debounced auto-analysis when user edits content
  useEffect(() => {
    if (isEditing && !isAnalyzing && editedFeedback) {
      if (autoAnalysisTimeoutRef.current) {
        clearTimeout(autoAnalysisTimeoutRef.current);
      }

      autoAnalysisTimeoutRef.current = setTimeout(() => {
        setAutoAnalysisDebounced(true);
        handleAIAnalyze();
      }, 1500);
    }

    return () => {
      if (autoAnalysisTimeoutRef.current) {
        clearTimeout(autoAnalysisTimeoutRef.current);
      }
    };
  }, [editedFeedback?.title, editedFeedback?.description, isEditing]);
