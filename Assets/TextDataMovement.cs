using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TextDataMovement : MonoBehaviour
{
    private Vector3 Direction;
    private TextMesh _textMesh;
    private int spawnTime = 0;
    public float scale = (float) 1;
    public Vector3 speed = new Vector3((float) 0.03, (float) 0.02, (float) 0.03);

    void Start()
    {
        Direction = new Vector3(0, 0, 0);
        _textMesh = GetComponent<TextMesh>();
        spawnTime = Time.frameCount;
    }

    // Update is called once per frame
    void Update()
    {
        var position = this.transform.position;
        var rotation = this.transform.rotation;

        var newPosition = GetPosition(position);
        var newRotation = rotation;

        this.transform.SetPositionAndRotation(newPosition, newRotation);
    }

    Vector3 GetPosition(Vector3 input)
    {
        var noise1 = (float) Math.Sin(spawnTime + speed.x * Time.frameCount);
        var noise2 = (float) Math.Cos(spawnTime + speed.y * Time.frameCount);
        var noise3 = (float) Math.Tan(spawnTime + speed.z * Time.frameCount);


        return new Vector3(scale * noise1, scale * noise2, scale * noise3);
    }

    public void SetText(string text)
    {
        _textMesh.text = text;
    }
}