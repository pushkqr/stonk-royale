let currentPrice = 1;

export const setLivePrice = (price) => {
  if (price != null && !Number.isNaN(price)) {
    currentPrice = price;
  }
};

export const getLivePrice = () => currentPrice;
