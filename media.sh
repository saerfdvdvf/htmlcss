#!/bin/bash
# Guarda los números del 1 al 10 en un array y calcula la media

declare -a numeros
suma=0

for (( i=0; i<10; i++ )); do
    numeros[$i]=$(( i + 1 ))
    suma=$(( suma + numeros[i] ))
done

total=${#numeros[@]}
entero=$(( suma / total ))
decimal=$(( suma * 10 / total % 10 ))

echo "Números: ${numeros[@]}"
echo "Cantidad: $total"
echo "Suma: $suma"
echo "Media: $entero.$decimal"
