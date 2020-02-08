package com.helloworld;
import org.json.JSONObject;

public class App 
{
    public static void main( String[] args )
    {
        JSONObject obj = new JSONObject();
        obj.put("Hello", "World!");
        System.out.println(obj.toString());
    }
}
