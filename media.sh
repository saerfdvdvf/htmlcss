#!/bin/bash
# Guarda los números del 1 al 10 en un array y calcula la media

numeros=(1 2 3 4 5 6 7 8 9 10)
suma=0

for num in "${numeros[@]}"; do
    echo "Número: $num"
    suma=$(( suma + num ))
done

total=${#numeros[@]}
entero=$(( suma / total ))
decimal=$(( suma * 10 / total % 10 ))

echo "Cantidad: $total"
echo "Suma: $suma"
echo "Media: $entero.$decimal"
