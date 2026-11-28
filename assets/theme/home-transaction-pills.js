(() => {
  const pills = document.querySelectorAll("[data-home-purpose]");
  const select = document.getElementById("purposeFilter");
  if (!pills.length || !select) return;
  const updateState = () => {
    pills.forEach((button) => {
      const active = select.value === button.dataset.homePurpose;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };
  pills.forEach((button) => {
    button.addEventListener("click", () => {
      select.value = button.dataset.homePurpose;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const searchButton = document.getElementById("searchBtn");
      if (searchButton) searchButton.click();
      updateState();
    });
  });
  select.addEventListener("change", updateState);
  updateState();
})();