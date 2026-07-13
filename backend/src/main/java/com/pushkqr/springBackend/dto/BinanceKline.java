package com.pushkqr.springBackend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonFormat(shape = JsonFormat.Shape.ARRAY)
@com.fasterxml.jackson.annotation.JsonPropertyOrder({"openTime", "open", "high", "low", "close", "volume", "closeTime"})
@JsonIgnoreProperties(ignoreUnknown = true)
public class BinanceKline {
    public long openTime;
    public String open;
    public String high;
    public String low;
    public String close;
    public String volume;
    public long closeTime;

}
