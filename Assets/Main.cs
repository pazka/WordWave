using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Main : MonoBehaviour
{
    public Camera [] cameras;
    private int _active = 0;
    public GameObject TextPrefab;
    void Start()
    {
        cameras[_active].enabled = true;
    }

    // Update is called once per frame
    void Update()
    {
        Console.WriteLine("test");
        
        if (Input.GetKeyDown(KeyCode.C))
        {
            ChangeCamera();
        }
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            Application.Quit();
        }
    }

    void ChangeCamera()
    {
        _active += 1;
        if (_active == cameras.Length)
            _active = 0;
        
        cameras[_active].enabled = true;
        Console.WriteLine($"Camera {_active}");
    }
    

    public void AddText(string text)
    {
        var newText = Instantiate(TextPrefab, new Vector3(0, 0, 0), Quaternion.identity);
        var script = newText.GetComponent<TextDataMovement>();
        script.SetText(text);
    }
}
